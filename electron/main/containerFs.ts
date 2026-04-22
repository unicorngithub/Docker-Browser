import path from 'node:path'
import { Readable } from 'node:stream'
import { extract, pack } from 'tar-stream'
import type { Headers } from 'tar-stream'
import type { Readable as NodeReadable } from 'node:stream'
import type { Container } from 'dockerode'
import { demuxDockerLogStream } from './dockerLogDemux'

export const CONTAINER_FS_MAX_READ_BYTES = 512 * 1024

export function normalizeContainerPath(p: string): string {
  const s = (p ?? '').trim() || '/'
  const n = path.posix.normalize(s.startsWith('/') ? s : `/${s}`)
  if (n.includes('\0')) throw new Error('invalid path')
  if (n === '/..') throw new Error('invalid path')
  return n
}

export async function streamToBuffer(stream: NodeReadable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
  return Buffer.concat(chunks)
}

/** 与 `ls -l` 类似的元数据；停止容器走 tar 时 nlink 常为 1、权限由 mode 推算。 */
export type TarListEntry = {
  name: string
  type: 'file' | 'directory'
  size: number
  mode: string
  nlink: number
  user: string
  group: string
  mtime: number
}

const LIST_DIR_TIMEOUT_MS = 90_000

const S_IFMT = 0o170000
const S_IFDIR = 0o040000
const S_IFREG = 0o100000
const S_IFLNK = 0o120000
const S_IFCHR = 0o020000
const S_IFBLK = 0o060000
const S_IFIFO = 0o010000
const S_IFSOCK = 0o140000

function modeToTypeChar(mode: number): string {
  switch (mode & S_IFMT) {
    case S_IFDIR:
      return 'd'
    case S_IFREG:
      return '-'
    case S_IFLNK:
      return 'l'
    case S_IFCHR:
      return 'c'
    case S_IFBLK:
      return 'b'
    case S_IFIFO:
      return 'p'
    case S_IFSOCK:
      return 's'
    default:
      return '-'
  }
}

function rwxBits(bits: number): string {
  return ((bits & 4) ? 'r' : '-') + ((bits & 2) ? 'w' : '-') + ((bits & 1) ? 'x' : '-')
}

/** 从 st_mode + tar 类型生成类似 `ls -l` 的 10 字符权限串。 */
export function posixModeToLsString(modeRaw: number | undefined, entryType: Headers['type']): string {
  const mode = modeRaw ?? 0
  const perm = mode & 0o777
  let tc: string
  if (entryType === 'directory') tc = 'd'
  else if (entryType === 'symlink') tc = 'l'
  else if (entryType === 'character-device') tc = 'c'
  else if (entryType === 'block-device') tc = 'b'
  else if (entryType === 'fifo') tc = 'p'
  else tc = modeToTypeChar(mode)
  if (tc === '-' && (mode & S_IFMT) === S_IFDIR) tc = 'd'
  const u = (perm >> 6) & 7
  const g = (perm >> 3) & 7
  const o = perm & 7
  return tc + rwxBits(u) + rwxBits(g) + rwxBits(o)
}

function tarMtimeToUnixSec(m: Headers['mtime']): number {
  if (m instanceof Date) return Math.floor(m.getTime() / 1000)
  if (typeof m === 'number' && Number.isFinite(m)) {
    return m > 1e12 ? Math.floor(m / 1000) : Math.floor(m)
  }
  return 0
}

function tarHeaderToEntry(name: string, header: Headers, treeType: 'file' | 'directory'): TarListEntry {
  const size = typeof header.size === 'number' ? header.size : 0
  const modeStr = posixModeToLsString(header.mode, header.type ?? (treeType === 'directory' ? 'directory' : 'file'))
  const mtime = tarMtimeToUnixSec(header.mtime)
  return {
    name,
    type: treeType,
    size: treeType === 'directory' ? 0 : size,
    mode: modeStr,
    nlink: 1,
    user: header.uname?.trim() || String(header.uid ?? ''),
    group: header.gname?.trim() || String(header.gid ?? ''),
    mtime,
  }
}

/** `sh -c`：$1 为目录；每行 typ|mode|nlink|user|group|size|mtime|name（name 可含 |，取第 8 段起）。 */
const LIST_DIR_SCRIPT = `cd "\$1" || exit 1
ls -1A 2>/dev/null | while IFS= read -r name || [ -n "\$name" ]; do
  [ -z "\$name" ] && continue
  case "\$name" in .|..) continue ;; esac
  if [ -d "\$name" ] && [ ! -L "\$name" ]; then
    typ=d
  else
    typ=f
  fi
  st=\$(stat -c '%A|%h|%U|%G|%s|%Y' "\$name" 2>/dev/null) || continue
  printf '%s|%s|%s\n' "\$typ" "\$st" "\$name"
done`

function sortTarEntries(entries: TarListEntry[]) {
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/** 解析 `LIST_DIR_SCRIPT` 行：`d|drwxr-xr-x|3|root|root|4096|1700000000|name` */
export function parseListDirExecOutput(output: string): TarListEntry[] {
  const entries: TarListEntry[] = []
  for (const line of output.split(/\r?\n/)) {
    if (!line) continue
    const parts = line.split('|')
    if (parts.length < 8) continue
    const typeChar = parts[0]
    const modeStr = parts[1] ?? '----------'
    const nlink = Math.max(0, Math.floor(Number(parts[2])) || 1)
    const user = parts[3] ?? ''
    const group = parts[4] ?? ''
    const size = Math.max(0, Math.floor(Number(parts[5])) || 0)
    const mtime = Math.floor(Number(parts[6])) || 0
    const name = parts.slice(7).join('|')
    if (!name || (typeChar !== 'd' && typeChar !== 'f')) continue
    entries.push({
      name,
      type: typeChar === 'd' ? 'directory' : 'file',
      size: typeChar === 'd' ? 0 : size,
      mode: modeStr || '----------',
      nlink,
      user: user || '-',
      group: group || '-',
      mtime,
    })
  }
  sortTarEntries(entries)
  return entries
}

/** 运行中容器：exec + ls/stat，避免 getArchive 整目录打包。 */
export async function listDirectoryViaExec(
  c: Container,
  dirPath: string,
  timeoutMs = LIST_DIR_TIMEOUT_MS,
): Promise<TarListEntry[]> {
  const { output, exitCode } = await containerExecArgv(
    c,
    ['sh', '-c', LIST_DIR_SCRIPT, 'sh', dirPath],
    timeoutMs,
  )
  if (exitCode !== 0 && exitCode !== undefined) {
    const msg = output.trim()
    throw new Error(msg || `list directory failed (exit ${exitCode})`)
  }
  return parseListDirExecOutput(output)
}

/** 解析 Docker getArchive 返回的 tar 流，得到第一层条目（不整包缓冲）。 */
export async function parseTarListFromStream(stream: NodeReadable): Promise<TarListEntry[]> {
  const entries: TarListEntry[] = []
  return new Promise((resolve, reject) => {
    const ex = extract()
    ex.on('entry', (header, stream, next) => {
      let n = String(header.name ?? '').replace(/^\.\/+/, '').replace(/\/+$/, '')
      if (!n || n === '.' || n === '..') {
        stream.resume()
        stream.on('end', next)
        return
      }
      const slash = n.indexOf('/')
      if (slash !== -1) {
        n = n.slice(0, slash)
      }
      const type = header.type === 'directory' ? 'directory' : 'file'
      if (!entries.some((e) => e.name === n)) entries.push(tarHeaderToEntry(n, header, type))
      stream.resume()
      stream.on('end', next)
    })
    ex.on('finish', () => {
      sortTarEntries(entries)
      resolve(entries)
    })
    ex.on('error', reject)
    stream.on('error', reject)
    stream.pipe(ex)
  })
}

/** 已停止容器：仍用 getArchive，但流式解析、不把整个 tar 读进内存。 */
export async function listDirectoryFromGetArchiveStream(c: Container, dirPath: string): Promise<TarListEntry[]> {
  const stream = (await c.getArchive({ path: dirPath })) as NodeReadable
  return parseTarListFromStream(stream)
}

/** 解析 Docker getArchive 返回的 tar，得到第一层条目名（相对 archive 根）。 */
export async function parseTarList(buf: Buffer): Promise<TarListEntry[]> {
  return parseTarListFromStream(Readable.from(buf))
}

/** 从 tar 中取第一个普通文件的完整内容（用于单文件 getArchive）。 */
export async function extractFirstFileFromTar(buf: Buffer, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ex = extract()
    let found: Buffer | null = null
    ex.on('entry', (header, stream, next) => {
      if (found !== null || header.type === 'directory') {
        stream.resume()
        stream.on('end', next)
        return
      }
      const chunks: Buffer[] = []
      let total = 0
      stream.on('data', (d: Buffer) => {
        total += d.length
        if (total > maxBytes) {
          stream.destroy()
          reject(new Error(`file exceeds ${maxBytes} bytes`))
          return
        }
        chunks.push(d)
      })
      stream.on('end', () => {
        found = Buffer.concat(chunks)
        next()
      })
      stream.on('error', reject)
    })
    ex.on('finish', () => {
      if (!found) reject(new Error('no file in archive'))
      else resolve(found)
    })
    ex.on('error', reject)
    Readable.from(buf).pipe(ex)
  })
}

export function packSingleFileEntry(entryName: string, body: Buffer): Readable {
  const p = pack()
  p.entry({ name: entryName, size: body.length }, body, (err) => {
    if (err) p.destroy(err)
    else p.finalize()
  })
  return p as Readable
}

export async function getArchiveBuffer(c: Container, archivePath: string): Promise<Buffer> {
  const stream = (await c.getArchive({ path: archivePath })) as NodeReadable
  return streamToBuffer(stream)
}

export async function containerExecArgv(
  c: Container,
  argv: string[],
  timeoutMs = 60_000,
): Promise<{ output: string; exitCode?: number }> {
  const exec = await c.exec({
    Cmd: argv,
    AttachStdout: true,
    AttachStderr: true,
  })
  const stream = (await exec.start({ hijack: true, stdin: false })) as NodeReadable
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      stream.destroy()
      reject(new Error(`exec timeout after ${timeoutMs}ms`))
    }, timeoutMs)
    const off = demuxDockerLogStream(stream, (_type, buf) => {
      chunks.push(buf)
    })
    stream.on('end', () => {
      clearTimeout(t)
      off()
      resolve()
    })
    stream.on('error', (e) => {
      clearTimeout(t)
      off()
      reject(e)
    })
  })
  const inspectExec = await exec.inspect()
  return {
    output: Buffer.concat(chunks).toString('utf8'),
    exitCode: inspectExec.ExitCode ?? undefined,
  }
}
