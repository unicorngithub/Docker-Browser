/** 与主进程 `loadURL` / `loadFile({ hash })` 约定：`#logs?…`、`#files?…` */

export type LogWindowRoute =
  | { mode: 'main' }
  | { mode: 'logs'; containerId: string }
  | { mode: 'logs-error' }
  | { mode: 'files'; containerId: string; initialPath: string }
  | { mode: 'files-error' }

export function parseLogWindowHash(): LogWindowRoute {
  const raw = window.location.hash.replace(/^#/, '')
  if (raw.startsWith('files')) {
    const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
    const sp = new URLSearchParams(q)
    const id = sp.get('containerId')?.trim()
    if (!id) return { mode: 'files-error' }
    let initial = sp.get('path')?.trim() || '/'
    if (!initial.startsWith('/')) initial = `/${initial}`
    return { mode: 'files', containerId: id, initialPath: initial }
  }
  if (!raw.startsWith('logs')) return { mode: 'main' }
  const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
  const id = new URLSearchParams(q).get('containerId')?.trim()
  if (!id) return { mode: 'logs-error' }
  return { mode: 'logs', containerId: id }
}
