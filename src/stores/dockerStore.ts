import { create } from 'zustand'
import { unwrapIpc } from '@/lib/ipc'

export type TabId = 'containers' | 'images' | 'networks' | 'volumes' | 'system' | 'events'

type DockerState = {
  tab: TabId
  setTab: (t: TabId) => void
  connectionOk: boolean | null
  globalError: string | null
  busy: boolean
  containers: unknown[]
  images: unknown[]
  networks: unknown[]
  volumeList: unknown[]
  systemInfo: unknown | null
  versionJson: unknown | null
  diskJson: unknown | null
  selectedContainerId: string | null
  setSelectedContainerId: (id: string | null) => void
  selectedImageRef: string | null
  setSelectedImageRef: (id: string | null) => void
  selectedNetworkId: string | null
  setSelectedNetworkId: (id: string | null) => void
  selectedVolumeName: string | null
  setSelectedVolumeName: (n: string | null) => void
  ping: () => Promise<void>
  loadTab: (t: TabId) => Promise<void>
  afterMutation: () => Promise<void>
}

export const useDockerStore = create<DockerState>((set, get) => ({
  tab: 'containers',
  setTab: (t) => {
    set({ tab: t })
    void get().loadTab(t)
  },
  connectionOk: null,
  globalError: null,
  busy: false,
  containers: [],
  images: [],
  networks: [],
  volumeList: [],
  systemInfo: null,
  versionJson: null,
  diskJson: null,
  selectedContainerId: null,
  setSelectedContainerId: (id) => set({ selectedContainerId: id }),
  selectedImageRef: null,
  setSelectedImageRef: (id) => set({ selectedImageRef: id }),
  selectedNetworkId: null,
  setSelectedNetworkId: (id) => set({ selectedNetworkId: id }),
  selectedVolumeName: null,
  setSelectedVolumeName: (n) => set({ selectedVolumeName: n }),

  ping: async () => {
    set({ globalError: null })
    try {
      await unwrapIpc(window.dockerDesktop.ping())
      set({ connectionOk: true })
    } catch (e) {
      set({
        connectionOk: false,
        globalError: e instanceof Error ? e.message : String(e),
      })
    }
  },

  loadTab: async (t) => {
    const dk = window.dockerDesktop
    set({ busy: true, globalError: null })
    try {
      if (get().connectionOk !== true) {
        await get().ping()
        if (get().connectionOk !== true) return
      }
      if (t === 'containers') {
        const list = await unwrapIpc(dk.listContainers({ all: true }))
        set({ containers: list })
      } else if (t === 'images') {
        const list = await unwrapIpc(dk.listImages())
        set({ images: list })
      } else if (t === 'networks') {
        const [list, ctr] = await Promise.all([
          unwrapIpc(dk.listNetworks()),
          unwrapIpc(dk.listContainers({ all: true })),
        ])
        set({ networks: list, containers: ctr })
      } else if (t === 'volumes') {
        const res = (await unwrapIpc(dk.listVolumes())) as { Volumes?: unknown[] }
        set({ volumeList: res.Volumes ?? [] })
      } else if (t === 'system') {
        const [info, ver, df] = await Promise.all([
          unwrapIpc(dk.info()),
          unwrapIpc(dk.version()),
          unwrapIpc(dk.df()),
        ])
        set({ systemInfo: info, versionJson: ver, diskJson: df })
      } else if (t === 'events') {
        /* 事件页数据由订阅流推送，此处仅确保连接可用 */
      }
    } catch (e) {
      set({
        globalError: e instanceof Error ? e.message : String(e),
        connectionOk: false,
      })
    } finally {
      set({ busy: false })
    }
  },

  afterMutation: async () => {
    const { tab, loadTab, ping } = get()
    await ping()
    await loadTab(tab)
  },
}))
