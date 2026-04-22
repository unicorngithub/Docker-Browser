const COMPOSE_PROJECT_LABEL = 'com.docker.compose.project'
const UNGROUPED_KEY = '__ungrouped__'

export function getComposeProjectName(labels: Record<string, string> | undefined): string | null {
  if (!labels) return null
  const raw = labels[COMPOSE_PROJECT_LABEL]
  if (typeof raw !== 'string') return null
  const v = raw.trim()
  return v.length ? v : null
}

export type ProjectGroup<T> = {
  projectKey: string
  projectLabel: string
  items: T[]
}

/** 按 Compose 项目名分组；无标签的容器归入「未分组」并排在最后。组内按容器名排序。 */
export function groupContainersByComposeProject<T extends { Id: string; Names?: string[]; Labels?: Record<string, string> }>(
  containers: T[],
  ungroupedLabel: string,
): ProjectGroup<T>[] {
  const map = new Map<string, { label: string; items: T[] }>()

  for (const c of containers) {
    const name = getComposeProjectName(c.Labels)
    const key = name ?? UNGROUPED_KEY
    const label = name ?? ungroupedLabel
    let g = map.get(key)
    if (!g) {
      g = { label, items: [] }
      map.set(key, g)
    }
    g.items.push(c)
  }

  const sortName = (c: T): string => {
    const n = c.Names?.[0]
    if (n) return n.replace(/^\//, '').toLowerCase()
    return c.Id.toLowerCase()
  }

  for (const g of map.values()) {
    g.items.sort((a, b) => sortName(a).localeCompare(sortName(b), undefined, { sensitivity: 'base' }))
  }

  const keys = [...map.keys()].sort((a, b) => {
    if (a === UNGROUPED_KEY) return 1
    if (b === UNGROUPED_KEY) return -1
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })

  return keys.map((projectKey) => {
    const g = map.get(projectKey)!
    return {
      projectKey,
      projectLabel: g.label,
      items: g.items,
    }
  })
}
