/**
 * 解析 `8080:80` 或 `8080:80/tcp` 形式的端口映射，供 HostConfig 使用。
 */
export function parsePortPublish(publish: string): {
  ExposedPorts: Record<string, Record<string, never>>
  HostConfig: { PortBindings: Record<string, { HostPort: string; HostIp?: string }[]> }
} | null {
  const exposed: Record<string, Record<string, never>> = {}
  const bindings: Record<string, { HostPort: string; HostIp?: string }[]> = {}

  for (const raw of publish.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const ipM = raw.match(/^((?:\d{1,3}\.){3}\d{1,3}):(\d+):(\d+)(?:\/(tcp|udp))?$/i)
    if (ipM) {
      const HostIp = ipM[1]
      const hostPort = ipM[2]
      const containerPort = ipM[3]
      const proto = (ipM[4] ?? 'tcp').toLowerCase()
      const key = `${containerPort}/${proto}`
      exposed[key] = {}
      if (!bindings[key]) bindings[key] = []
      bindings[key].push({ HostIp, HostPort: hostPort })
      continue
    }
    const m = raw.match(/^(\d+):(\d+)(?:\/(tcp|udp))?$/i)
    if (!m) continue
    const hostPort = m[1]
    const containerPort = m[2]
    const proto = (m[3] ?? 'tcp').toLowerCase()
    const key = `${containerPort}/${proto}`
    exposed[key] = {}
    if (!bindings[key]) bindings[key] = []
    bindings[key].push({ HostPort: hostPort })
  }

  if (Object.keys(exposed).length === 0) return null

  return {
    ExposedPorts: exposed,
    HostConfig: { PortBindings: bindings },
  }
}

export function parseEnvLines(text: string): string[] {
  const out: string[] = []
  for (const line of text.split('\n')) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    out.push(s)
  }
  return out
}
