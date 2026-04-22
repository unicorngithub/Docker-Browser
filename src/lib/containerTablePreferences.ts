const LS_KEY = 'docker-browser:containers-table-cols'

export type ContainerTableColId = 'name' | 'id' | 'image' | 'ports' | 'state' | 'status' | 'health'

export const ALL_CONTAINER_COLS: ContainerTableColId[] = [
  'name',
  'id',
  'image',
  'ports',
  'state',
  'status',
  'health',
]

const DEFAULT_VISIBLE: Record<ContainerTableColId, boolean> = {
  name: true,
  id: true,
  image: true,
  ports: true,
  state: true,
  status: true,
  health: true,
}

export function loadColVisibility(): Record<ContainerTableColId, boolean> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULT_VISIBLE }
    const o = JSON.parse(raw) as Record<string, boolean>
    const out = { ...DEFAULT_VISIBLE }
    for (const id of ALL_CONTAINER_COLS) {
      if (typeof o[id] === 'boolean') out[id] = o[id]
    }
    return out
  } catch {
    return { ...DEFAULT_VISIBLE }
  }
}

export function saveColVisibility(v: Record<ContainerTableColId, boolean>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}
