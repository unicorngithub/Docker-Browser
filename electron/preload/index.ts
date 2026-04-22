import { contextBridge, ipcRenderer } from 'electron'
import type { AppLanguage } from '../../shared/locale'
import type { ThemePreference } from '../../shared/theme'
import type { IpcResult } from '../../shared/ipc'
import type { DockerLogsChunk } from '../../shared/dockerLogs'
import type { DockerEventChunk } from '../../shared/dockerEvents'

contextBridge.exposeInMainWorld('dockerDesktop', {
  ping(): Promise<IpcResult<string>> {
    return ipcRenderer.invoke('docker:ping')
  },
  info(): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke('docker:info')
  },
  version(): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke('docker:version')
  },
  df(): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke('docker:df')
  },
  listContainers(opts?: { all?: boolean }): Promise<IpcResult<unknown[]>> {
    return ipcRenderer.invoke('docker:list-containers', opts)
  },
  inspectContainer(id: string): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke('docker:inspect-container', id)
  },
  startContainer(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:start-container', id)
  },
  stopContainer(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:stop-container', id)
  },
  restartContainer(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:restart-container', id)
  },
  killContainer(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:kill-container', id)
  },
  pauseContainer(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:pause-container', id)
  },
  unpauseContainer(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:unpause-container', id)
  },
  removeContainer(payload: { id: string; force?: boolean; v?: boolean }): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:remove-container', payload)
  },
  listImages(): Promise<IpcResult<unknown[]>> {
    return ipcRenderer.invoke('docker:list-images')
  },
  inspectImage(name: string): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke('docker:inspect-image', name)
  },
  removeImage(payload: { name: string; force?: boolean; noprune?: boolean }): Promise<IpcResult<unknown[]>> {
    return ipcRenderer.invoke('docker:remove-image', payload)
  },
  pullImage(repoTag: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:pull-image', repoTag)
  },
  createRunContainer(payload: {
    image: string
    name?: string
    envText?: string
    publishText?: string
    cmdText?: string
    autoRemove?: boolean
    restartPolicy?: string
  }): Promise<IpcResult<{ id: string }>> {
    return ipcRenderer.invoke('docker:create-run-container', payload)
  },
  recreateContainer(payload: {
    containerId: string
    image: string
    name?: string
    envText?: string
    publishText?: string
    cmdText?: string
    autoRemove?: boolean
    restartPolicy?: string
  }): Promise<IpcResult<{ id: string }>> {
    return ipcRenderer.invoke('docker:recreate-container', payload)
  },
  patchContainerRuntime(payload: {
    containerId: string
    name?: string
    restartPolicy?: string
  }): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:patch-container-runtime', payload)
  },
  tagImage(payload: { source: string; repo: string; tag?: string }): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:tag-image', payload)
  },
  execOnce(payload: { containerId: string; command: string }): Promise<
    IpcResult<{ output: string; exitCode?: number }>
  > {
    return ipcRenderer.invoke('docker:exec-once', payload)
  },
  startEvents(opts?: { sinceUnix?: number }): Promise<IpcResult<{ subscriptionId: string }>> {
    return ipcRenderer.invoke('docker:events:start', opts)
  },
  stopEvents(subscriptionId: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:events:stop', subscriptionId)
  },
  listNetworks(): Promise<IpcResult<unknown[]>> {
    return ipcRenderer.invoke('docker:list-networks')
  },
  removeNetwork(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:remove-network', id)
  },
  listVolumes(): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke('docker:list-volumes')
  },
  removeVolume(name: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:remove-volume', name)
  },
  startLogs(opts: { containerId: string; tail?: number; timestamps?: boolean }): Promise<
    IpcResult<{ subscriptionId: string }>
  > {
    return ipcRenderer.invoke('docker:logs:start', opts)
  },
  stopLogs(subscriptionId: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:logs:stop', subscriptionId)
  },
  openContainerLogsWindow(containerId: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('app:open-container-logs-window', containerId)
  },
  openEngineDocs(): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('docker:open-docs')
  },
  onLogsChunk(handler: (msg: DockerLogsChunk) => void): () => void {
    const wrap = (_e: Electron.IpcRendererEvent, msg: unknown) => {
      const m = msg as DockerLogsChunk
      if (m && typeof m.subscriptionId === 'string' && typeof m.text === 'string') handler(m)
    }
    ipcRenderer.on('docker:logs:chunk', wrap)
    return () => ipcRenderer.removeListener('docker:logs:chunk', wrap)
  },
  onEventsChunk(handler: (msg: DockerEventChunk) => void): () => void {
    const wrap = (_e: Electron.IpcRendererEvent, msg: unknown) => {
      const m = msg as DockerEventChunk
      if (m && typeof m.subscriptionId === 'string' && typeof m.line === 'string') handler(m)
    }
    ipcRenderer.on('docker:events:chunk', wrap)
    return () => ipcRenderer.removeListener('docker:events:chunk', wrap)
  },
})

contextBridge.exposeInMainWorld('appTheme', {
  notifyPreferenceChanged(pref: ThemePreference) {
    ipcRenderer.send('app:theme-preference-changed', pref)
  },
  onMenuSelect(handler: (pref: ThemePreference) => void): () => void {
    const wrap = (_e: Electron.IpcRendererEvent, pref: unknown) => {
      if (pref === 'light' || pref === 'dark' || pref === 'system') handler(pref)
    }
    ipcRenderer.on('app-menu:theme', wrap)
    return () => ipcRenderer.removeListener('app-menu:theme', wrap)
  },
})

contextBridge.exposeInMainWorld('appLocale', {
  notifyLanguageChanged(lng: AppLanguage) {
    if (lng === 'en' || lng === 'zh-CN') ipcRenderer.send('app:language-changed', lng)
  },
  onMenuLanguageSelect(handler: (lng: AppLanguage) => void): () => void {
    const wrap = (_e: Electron.IpcRendererEvent, lng: unknown) => {
      if (lng === 'en' || lng === 'zh-CN') handler(lng)
    }
    ipcRenderer.on('app-menu:language', wrap)
    return () => ipcRenderer.removeListener('app-menu:language', wrap)
  },
})
