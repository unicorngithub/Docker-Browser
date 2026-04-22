const LS_KEY = 'docker-browser:exec-cmd-history'
const MAX = 24

export function loadExecHistory(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    if (!Array.isArray(a)) return []
    return a.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, MAX)
  } catch {
    return []
  }
}

export function pushExecHistory(cmd: string): void {
  const line = cmd.trim()
  if (!line) return
  const prev = loadExecHistory().filter((x) => x !== line)
  const next = [line, ...prev].slice(0, MAX)
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
