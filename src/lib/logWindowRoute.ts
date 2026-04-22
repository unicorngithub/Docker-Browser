/** 与主进程 `loadURL` / `loadFile({ hash })` 约定一致：`#logs?containerId=…` */
export function parseLogWindowHash(): { mode: 'main' } | { mode: 'logs'; containerId: string } | { mode: 'logs-error' } {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw.startsWith('logs')) return { mode: 'main' }
  const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
  const id = new URLSearchParams(q).get('containerId')?.trim()
  if (!id) return { mode: 'logs-error' }
  return { mode: 'logs', containerId: id }
}
