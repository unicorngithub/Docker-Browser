import { app, ipcMain, shell, type WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import type { Readable } from 'node:stream'
import type { ContainerCreateOptions, HostConfig } from 'dockerode'
import type { DockerLogsChunk } from '../../shared/dockerLogs'
import { ipcErr, ipcOk, type IpcResult } from '../../shared/ipc'
import { getDocker } from './dockerClient'
import { demuxDockerLogStream } from './dockerLogDemux'
import { parseEnvLines, parsePortPublish } from './dockerCreateHelpers'
import { buildRecreateCreateOptions } from './dockerRecreateHelpers'

type StreamSub = {
  wc: WebContents
  destroy: () => void
}

const logSubs = new Map<string, StreamSub>()
const eventSubs = new Map<string, StreamSub>()

let registered = false

function docker() {
  return getDocker()
}

export function registerDockerIpc(): void {
  if (registered) return
  registered = true

  app.on('before-quit', () => {
    for (const sub of logSubs.values()) sub.destroy()
    logSubs.clear()
    for (const sub of eventSubs.values()) sub.destroy()
    eventSubs.clear()
  })

  ipcMain.handle('docker:ping', async (): Promise<IpcResult<string>> => {
    try {
      await docker().ping()
      return ipcOk('ok')
    } catch (e) {
      return ipcErr(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle('docker:info', async (): Promise<IpcResult<unknown>> => {
    try {
      return ipcOk(await docker().info())
    } catch (e) {
      return ipcErr(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle('docker:version', async (): Promise<IpcResult<unknown>> => {
    try {
      return ipcOk(await docker().version())
    } catch (e) {
      return ipcErr(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle('docker:df', async (): Promise<IpcResult<unknown>> => {
    try {
      return ipcOk(await docker().df())
    } catch (e) {
      return ipcErr(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle(
    'docker:list-containers',
    async (_evt, opts?: { all?: boolean }): Promise<IpcResult<unknown[]>> => {
      try {
        const list = await docker().listContainers({ all: opts?.all !== false })
        return ipcOk(list)
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle(
    'docker:inspect-container',
    async (_evt, id: unknown): Promise<IpcResult<unknown>> => {
      if (typeof id !== 'string' || !id) return ipcErr('invalid id')
      try {
        const c = docker().getContainer(id)
        return ipcOk(await c.inspect())
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle('docker:start-container', async (_evt, id: unknown): Promise<IpcResult<void>> => {
    if (typeof id !== 'string' || !id) return ipcErr('invalid id')
    try {
      const c = docker().getContainer(id)
      await c.start()
      return ipcOk(undefined)
    } catch (e) {
      return ipcErr(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle('docker:stop-container', async (_evt, id: unknown): Promise<IpcResult<void>> => {
    if (typeof id !== 'string' || !id) return ipcErr('invalid id')
    try {
      const c = docker().getContainer(id)
      await c.stop()
      return ipcOk(undefined)
    } catch (e) {
      return ipcErr(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle('docker:restart-container', async (_evt, id: unknown): Promise<IpcResult<void>> => {
    if (typeof id !== 'string' || !id) return ipcErr('invalid id')
    try {
      const c = docker().getContainer(id)
      await c.restart()
      return ipcOk(undefined)
    } catch (e) {
      return ipcErr(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle('docker:kill-container', async (_evt, id: unknown): Promise<IpcResult<void>> => {
    if (typeof id !== 'string' || !id) return ipcErr('invalid id')
    try {
      const c = docker().getContainer(id)
      await c.kill()
      return ipcOk(undefined)
    } catch (e) {
      return ipcErr(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle(
    'docker:pause-container',
    async (_evt, id: unknown): Promise<IpcResult<void>> => {
      if (typeof id !== 'string' || !id) return ipcErr('invalid id')
      try {
        const c = docker().getContainer(id)
        await c.pause()
        return ipcOk(undefined)
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle(
    'docker:unpause-container',
    async (_evt, id: unknown): Promise<IpcResult<void>> => {
      if (typeof id !== 'string' || !id) return ipcErr('invalid id')
      try {
        const c = docker().getContainer(id)
        await c.unpause()
        return ipcOk(undefined)
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle(
    'docker:remove-container',
    async (_evt, payload: unknown): Promise<IpcResult<void>> => {
      const p = payload as { id?: string; force?: boolean; v?: boolean }
      if (typeof p?.id !== 'string' || !p.id) return ipcErr('invalid id')
      try {
        const c = docker().getContainer(p.id)
        await c.remove({ force: p.force === true, v: p.v === true })
        return ipcOk(undefined)
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle('docker:list-images', async (): Promise<IpcResult<unknown[]>> => {
    try {
      return ipcOk(await docker().listImages())
    } catch (e) {
      return ipcErr(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle(
    'docker:inspect-image',
    async (_evt, name: unknown): Promise<IpcResult<unknown>> => {
      if (typeof name !== 'string' || !name) return ipcErr('invalid name')
      try {
        const img = docker().getImage(name)
        return ipcOk(await img.inspect())
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle(
    'docker:remove-image',
    async (_evt, payload: unknown): Promise<IpcResult<unknown[]>> => {
      const p = payload as { name?: string; force?: boolean; noprune?: boolean }
      if (typeof p?.name !== 'string' || !p.name) return ipcErr('invalid name')
      try {
        const img = docker().getImage(p.name)
        const res = await img.remove({ force: p.force === true, noprune: p.noprune === true })
        return ipcOk(res)
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle('docker:pull-image', async (_evt, repoTag: unknown): Promise<IpcResult<void>> => {
    if (typeof repoTag !== 'string' || !repoTag) return ipcErr('invalid repoTag')
    try {
      const dk = docker()
      await new Promise<void>((resolve, reject) => {
        dk.pull(repoTag, (err: Error | null, stream: Readable | undefined) => {
          if (err || !stream) {
            reject(err ?? new Error('no stream'))
            return
          }
          dk.modem.followProgress(stream, () => {}, (err2: Error | null) => {
            if (err2) reject(err2)
            else resolve()
          })
        })
      })
      return ipcOk(undefined)
    } catch (e) {
      return ipcErr(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle('docker:list-networks', async (): Promise<IpcResult<unknown[]>> => {
    try {
      return ipcOk(await docker().listNetworks())
    } catch (e) {
      return ipcErr(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle(
    'docker:remove-network',
    async (_evt, id: unknown): Promise<IpcResult<void>> => {
      if (typeof id !== 'string' || !id) return ipcErr('invalid id')
      try {
        const n = docker().getNetwork(id)
        await n.remove()
        return ipcOk(undefined)
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle('docker:list-volumes', async (): Promise<IpcResult<unknown>> => {
    try {
      return ipcOk(await docker().listVolumes())
    } catch (e) {
      return ipcErr(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle(
    'docker:remove-volume',
    async (_evt, name: unknown): Promise<IpcResult<void>> => {
      if (typeof name !== 'string' || !name) return ipcErr('invalid name')
      try {
        const v = docker().getVolume(name)
        await v.remove()
        return ipcOk(undefined)
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle(
    'docker:logs:start',
    async (
      evt,
      opts: { containerId: string; tail?: number; timestamps?: boolean },
    ): Promise<IpcResult<{ subscriptionId: string }>> => {
      try {
        const { containerId, tail = 200, timestamps = true } = opts ?? {}
        if (typeof containerId !== 'string' || !containerId) return ipcErr('invalid containerId')

        const c = docker().getContainer(containerId)
        const inspect = await c.inspect()

        const stream = (await c.logs({
          follow: true,
          stdout: true,
          stderr: true,
          tail,
          timestamps,
        })) as unknown as Readable

        const subscriptionId = randomUUID()
        const wc = evt.sender

        const sendText = (text: string) => {
          if (wc.isDestroyed()) return
          wc.send('docker:logs:chunk', { subscriptionId, text } satisfies DockerLogsChunk)
        }

        const destroyStream = () => {
          try {
            stream.destroy()
          } catch {
            /* ignore */
          }
        }

        let offDemux: (() => void) | undefined

        if (inspect.Config.Tty === true) {
          const onData = (chunk: Buffer) => sendText(chunk.toString('utf8'))
          stream.on('data', onData)
          offDemux = () => stream.off('data', onData)
        } else {
          offDemux = demuxDockerLogStream(stream, (_type, payload) => {
            sendText(payload.toString('utf8'))
          })
        }

        const destroy = () => {
          offDemux?.()
          destroyStream()
        }

        const sub: StreamSub = { wc, destroy }
        logSubs.set(subscriptionId, sub)

        const done = () => {
          destroy()
          logSubs.delete(subscriptionId)
        }

        stream.on('end', done)
        stream.on('close', done)
        stream.on('error', done)

        wc.once('destroyed', () => {
          if (logSubs.has(subscriptionId)) done()
        })

        return ipcOk({ subscriptionId })
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle(
    'docker:logs:stop',
    async (_evt, subscriptionId: unknown): Promise<IpcResult<void>> => {
      if (typeof subscriptionId !== 'string') return ipcErr('invalid subscription')
      const sub = logSubs.get(subscriptionId)
      if (!sub) return ipcOk(undefined)
      sub.destroy()
      logSubs.delete(subscriptionId)
      return ipcOk(undefined)
    },
  )

  ipcMain.handle(
    'docker:create-run-container',
    async (
      _evt,
      payload: unknown,
    ): Promise<IpcResult<{ id: string }>> => {
      const p = payload as {
        image?: string
        name?: string
        envText?: string
        publishText?: string
        cmdText?: string
        autoRemove?: boolean
      }
      const image = typeof p.image === 'string' ? p.image.trim() : ''
      if (!image) return ipcErr('image is required')

      const env = parseEnvLines(typeof p.envText === 'string' ? p.envText : '')
      const ports = typeof p.publishText === 'string' ? parsePortPublish(p.publishText) : null

      const cmdRaw = typeof p.cmdText === 'string' ? p.cmdText.trim() : ''
      const Cmd = cmdRaw ? cmdRaw.split(/\s+/).filter(Boolean) : undefined

      const name =
        typeof p.name === 'string' && p.name.trim()
          ? p.name.trim().replace(/^\/+/, '').toLowerCase()
          : undefined

      try {
        const createOpts: ContainerCreateOptions = { Image: image }
        if (env.length) createOpts.Env = env
        if (Cmd && Cmd.length) createOpts.Cmd = Cmd

        const hostConfig: HostConfig = {}
        if (p.autoRemove === true) hostConfig.AutoRemove = true
        if (ports) {
          createOpts.ExposedPorts = ports.ExposedPorts
          Object.assign(hostConfig, ports.HostConfig)
        }
        if (Object.keys(hostConfig).length > 0) createOpts.HostConfig = hostConfig

        const created = await docker().createContainer(name ? { ...createOpts, name } : createOpts)
        await created.start()
        return ipcOk({ id: created.id })
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle(
    'docker:recreate-container',
    async (_evt, payload: unknown): Promise<IpcResult<{ id: string }>> => {
      const p = payload as {
        containerId?: string
        image?: string
        name?: string
        envText?: string
        publishText?: string
        cmdText?: string
        autoRemove?: boolean
      }
      const containerId = typeof p.containerId === 'string' ? p.containerId.trim() : ''
      const image = typeof p.image === 'string' ? p.image.trim() : ''
      if (!containerId) return ipcErr('containerId is required')
      if (!image) return ipcErr('image is required')

      try {
        const old = docker().getContainer(containerId)
        const ins = await old.inspect()
        const { createOpts, name } = buildRecreateCreateOptions(ins, {
          image,
          name: typeof p.name === 'string' ? p.name : undefined,
          envText: typeof p.envText === 'string' ? p.envText : '',
          publishText: typeof p.publishText === 'string' ? p.publishText : '',
          cmdText: typeof p.cmdText === 'string' ? p.cmdText : undefined,
          autoRemove: p.autoRemove === true,
        })

        if (ins.State.Paused) await old.unpause()
        if (ins.State.Running || ins.State.Restarting) await old.stop({ t: 10 })
        await old.remove()

        const created = await docker().createContainer(name ? { ...createOpts, name } : createOpts)
        await created.start()
        return ipcOk({ id: created.id })
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle(
    'docker:tag-image',
    async (
      _evt,
      payload: unknown,
    ): Promise<IpcResult<void>> => {
      const p = payload as { source?: string; repo?: string; tag?: string }
      const source = typeof p.source === 'string' ? p.source.trim() : ''
      const repo = typeof p.repo === 'string' ? p.repo.trim() : ''
      const tag = typeof p.tag === 'string' && p.tag.trim() ? p.tag.trim() : 'latest'
      if (!source || !repo) return ipcErr('source and repo are required')
      try {
        const img = docker().getImage(source)
        await img.tag({ repo, tag })
        return ipcOk(undefined)
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle(
    'docker:exec-once',
    async (_evt, payload: unknown): Promise<IpcResult<{ output: string; exitCode?: number }>> => {
      const p = payload as { containerId?: string; command?: string }
      const containerId = typeof p.containerId === 'string' ? p.containerId.trim() : ''
      const command = typeof p.command === 'string' ? p.command.trim() : ''
      if (!containerId) return ipcErr('invalid containerId')
      if (!command) return ipcErr('command is required')
      try {
        const c = docker().getContainer(containerId)
        const exec = await c.exec({
          Cmd: ['sh', '-c', command],
          AttachStdout: true,
          AttachStderr: true,
        })
        const stream = (await exec.start({ hijack: true, stdin: false })) as unknown as Readable
        const chunks: Buffer[] = []
        await new Promise<void>((resolve, reject) => {
          const off = demuxDockerLogStream(stream, (_type, buf) => {
            chunks.push(buf)
          })
          stream.on('end', () => {
            off()
            resolve()
          })
          stream.on('error', (err) => {
            off()
            reject(err)
          })
        })
        const inspectExec = await exec.inspect()
        return ipcOk({
          output: Buffer.concat(chunks).toString('utf8'),
          exitCode: inspectExec.ExitCode ?? undefined,
        })
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle(
    'docker:events:start',
    async (_evt, opts?: { sinceUnix?: number }): Promise<IpcResult<{ subscriptionId: string }>> => {
      try {
        const subscriptionId = randomUUID()
        const wc = _evt.sender

        const sinceUnix =
          typeof opts?.sinceUnix === 'number' && Number.isFinite(opts.sinceUnix)
            ? Math.floor(opts.sinceUnix)
            : undefined

        const stream = (await new Promise<Readable>((resolve, reject) => {
          docker().getEvents(
            {
              since: sinceUnix,
            },
            (err, s) => {
              if (err) reject(err)
              else if (!s) reject(new Error('no events stream'))
              else resolve(s as Readable)
            },
          )
        })) as Readable

        let buf = ''
        const sendLine = (line: string) => {
          if (wc.isDestroyed()) return
          wc.send('docker:events:chunk', { subscriptionId, line })
        }

        const onData = (chunk: Buffer) => {
          buf += chunk.toString('utf8')
          const parts = buf.split('\n')
          buf = parts.pop() ?? ''
          for (const line of parts) {
            const t = line.trim()
            if (t) sendLine(t)
          }
        }

        const destroyStream = () => {
          try {
            stream.destroy()
          } catch {
            /* ignore */
          }
        }

        stream.on('data', onData)
        const destroy = () => {
          stream.off('data', onData)
          destroyStream()
        }

        const sub: StreamSub = { wc, destroy }
        eventSubs.set(subscriptionId, sub)

        const done = () => {
          destroy()
          eventSubs.delete(subscriptionId)
        }

        stream.on('end', done)
        stream.on('close', done)
        stream.on('error', done)

        wc.once('destroyed', () => {
          if (eventSubs.has(subscriptionId)) done()
        })

        return ipcOk({ subscriptionId })
      } catch (e) {
        return ipcErr(e instanceof Error ? e.message : String(e))
      }
    },
  )

  ipcMain.handle(
    'docker:events:stop',
    async (_evt, subscriptionId: unknown): Promise<IpcResult<void>> => {
      if (typeof subscriptionId !== 'string') return ipcErr('invalid subscription')
      const sub = eventSubs.get(subscriptionId)
      if (!sub) return ipcOk(undefined)
      sub.destroy()
      eventSubs.delete(subscriptionId)
      return ipcOk(undefined)
    },
  )

  ipcMain.handle('docker:open-docs', async (): Promise<IpcResult<void>> => {
    void shell.openExternal('https://docs.docker.com/engine/api/latest/')
    return ipcOk(undefined)
  })
}
