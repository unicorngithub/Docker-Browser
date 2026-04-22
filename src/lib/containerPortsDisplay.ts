/** `docker ps` / listContainers 返回的端口项（与 Engine API 一致） */
export type ContainerPortRow = {
  IP?: string
  PrivatePort?: number
  PublicPort?: number
  Type?: string
}

/**
 * 每条一行：`本机侧 : 容器端口/协议`（两侧用空格+冒号+空格分隔，避免 IPv4 与本机端口的多冒号歧义）。
 * 仅暴露未发布时本机侧为 `—`。展示行完全相同时会去重（Engine 的 `Ports` 数组常含重复项）。
 */
export function formatContainerPortsSummary(ports: ContainerPortRow[] | undefined): string {
  if (!ports?.length) return ''

  const seen = new Set<string>()
  const lines: string[] = []
  for (const p of ports) {
    const priv = p.PrivatePort
    if (priv === undefined || priv === null) continue
    const typ = (p.Type ?? 'tcp').toLowerCase()
    const pub = p.PublicPort
    const hasPublish = pub !== undefined && pub !== null && pub > 0
    const containerPart = `${priv}/${typ}`

    let line: string
    if (hasPublish) {
      const ip = p.IP?.trim()
      const defaultIp =
        !ip || ip === '0.0.0.0' || ip === '::' || ip === '[::]' || ip === '::/0'
      const hostBinding = defaultIp ? String(pub) : `${ip}:${pub}`
      line = `${hostBinding} : ${containerPart}`
    } else {
      line = `— : ${containerPart}`
    }

    if (seen.has(line)) continue
    seen.add(line)
    lines.push(line)
  }
  return lines.join('\n')
}
