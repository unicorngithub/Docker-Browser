import { contextBridge, ipcRenderer } from 'electron'
import type { AppLanguage } from '../../shared/locale'
import type { ThemePreference } from '../../shared/theme'
import type { IpcResult } from '../../shared/ipc'
import type { DockerLogsChunk } from '../../shared/dockerLogs'
import type { DockerEventChunk } from '../../shared/dockerEvents'
import { DockerIpc } from '../../shared/dockerIpcChannels'

contextBridge.exposeInMainWorld('dockerDesktop', {
  ping(): Promise<IpcResult<string>> {
    return ipcRenderer.invoke(DockerIpc.ping)
  },
  info(): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke(DockerIpc.info)
  },
  version(): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke(DockerIpc.version)
  },
  df(): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke(DockerIpc.df)
  },
  listContainers(opts?: { all?: boolean }): Promise<IpcResult<unknown[]>> {
    return ipcRenderer.invoke(DockerIpc.listContainers, opts)
  },
  inspectContainer(id: string): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke(DockerIpc.inspectContainer, id)
  },
  startContainer(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.startContainer, id)
  },
  stopContainer(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.stopContainer, id)
  },
  restartContainer(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.restartContainer, id)
  },
  killContainer(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.killContainer, id)
  },
  pauseContainer(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.pauseContainer, id)
  },
  unpauseContainer(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.unpauseContainer, id)
  },
  removeContainer(payload: { id: string; force?: boolean; v?: boolean }): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.removeContainer, payload)
  },
  listImages(): Promise<IpcResult<unknown[]>> {
    return ipcRenderer.invoke(DockerIpc.listImages)
  },
  inspectImage(name: string): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke(DockerIpc.inspectImage, name)
  },
  removeImage(payload: { name: string; force?: boolean; noprune?: boolean }): Promise<IpcResult<unknown[]>> {
    return ipcRenderer.invoke(DockerIpc.removeImage, payload)
  },
  pullImage(repoTag: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.pullImage, repoTag)
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
    return ipcRenderer.invoke(DockerIpc.createRunContainer, payload)
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
    return ipcRenderer.invoke(DockerIpc.recreateContainer, payload)
  },
  patchContainerRuntime(payload: {
    containerId: string
    name?: string
    restartPolicy?: string
    memoryMb?: number
    cpus?: number
    pidsLimit?: number
  }): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.patchContainerRuntime, payload)
  },
  tagImage(payload: { source: string; repo: string; tag?: string }): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.tagImage, payload)
  },
  execOnce(payload: { containerId: string; command: string }): Promise<
    IpcResult<{ output: string; exitCode?: number }>
  > {
    return ipcRenderer.invoke(DockerIpc.execOnce, payload)
  },
  startEvents(opts?: { sinceUnix?: number }): Promise<IpcResult<{ subscriptionId: string }>> {
    return ipcRenderer.invoke(DockerIpc.eventsStart, opts)
  },
  stopEvents(subscriptionId: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.eventsStop, subscriptionId)
  },
  listNetworks(): Promise<IpcResult<unknown[]>> {
    return ipcRenderer.invoke(DockerIpc.listNetworks)
  },
  removeNetwork(id: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.removeNetwork, id)
  },
  listVolumes(): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke(DockerIpc.listVolumes)
  },
  removeVolume(name: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.removeVolume, name)
  },
  startLogs(opts: { containerId: string; tail?: number; timestamps?: boolean }): Promise<
    IpcResult<{ subscriptionId: string }>
  > {
    return ipcRenderer.invoke(DockerIpc.logsStart, opts)
  },
  stopLogs(subscriptionId: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.logsStop, subscriptionId)
  },
  openContainerLogsWindow(containerId: string): Promise<IpcResult<void>> {
    return ipcRenderer.invoke('app:open-container-logs-window', containerId)
  },
  openEngineDocs(): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.openDocs)
  },
  pruneContainers(): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke(DockerIpc.pruneContainers)
  },
  pruneImages(opts?: { danglingOnly?: boolean }): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke(DockerIpc.pruneImages, opts ?? {})
  },
  pruneNetworks(): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke(DockerIpc.pruneNetworks)
  },
  pruneVolumes(): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke(DockerIpc.pruneVolumes)
  },
  pruneBuilder(): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke(DockerIpc.pruneBuilder)
  },
  systemPrune(opts?: { volumes?: boolean; allImages?: boolean }): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke(DockerIpc.systemPrune, opts ?? {})
  },
  createNetwork(payload: { name: string; driver?: string }): Promise<IpcResult<{ id: string }>> {
    return ipcRenderer.invoke(DockerIpc.createNetwork, payload)
  },
  createVolume(payload: { name: string }): Promise<IpcResult<{ name: string }>> {
    return ipcRenderer.invoke(DockerIpc.createVolume, payload)
  },
  networkConnect(payload: { networkId: string; containerId: string }): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.networkConnect, payload)
  },
  networkDisconnect(payload: {
    networkId: string
    containerId: string
    force?: boolean
  }): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.networkDisconnect, payload)
  },
  volumeUsedBy(volumeName: string): Promise<IpcResult<{ containerIds: string[] }>> {
    return ipcRenderer.invoke(DockerIpc.volumeUsedBy, volumeName)
  },
  containerStatsOnce(containerId: string): Promise<IpcResult<unknown>> {
    return ipcRenderer.invoke(DockerIpc.containerStatsOnce, containerId)
  },
  imageHistory(name: string): Promise<IpcResult<unknown[]>> {
    return ipcRenderer.invoke(DockerIpc.imageHistory, name)
  },
  saveImageTar(payload: { name: string }): Promise<IpcResult<{ filePath: string }>> {
    return ipcRenderer.invoke(DockerIpc.saveImageTar, payload)
  },
  loadImageTar(): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.loadImageTar)
  },
  commitContainer(payload: {
    containerId: string
    repo: string
    tag?: string
    comment?: string
  }): Promise<IpcResult<{ id: string }>> {
    return ipcRenderer.invoke(DockerIpc.commitContainer, payload)
  },
  exportContainerTar(payload: { containerId: string }): Promise<IpcResult<{ filePath: string }>> {
    return ipcRenderer.invoke(DockerIpc.exportContainerTar, payload)
  },
  reconnectDocker(): Promise<IpcResult<void>> {
    return ipcRenderer.invoke(DockerIpc.reconnectDocker)
  },
  getDockerRuntimeEnv(): Promise<IpcResult<{ dockerHost: string; dockerContext: string }>> {
    return ipcRenderer.invoke('app:get-docker-runtime-env')
  },
  getComposeVersion(): Promise<IpcResult<string>> {
    return ipcRenderer.invoke('app:get-compose-version')
  },
  onLogsChunk(handler: (msg: DockerLogsChunk) => void): () => void {
    const wrap = (_e: Electron.IpcRendererEvent, msg: unknown) => {
      const m = msg as DockerLogsChunk
      if (m && typeof m.subscriptionId === 'string' && typeof m.text === 'string') handler(m)
    }
    ipcRenderer.on(DockerIpc.logsChunk, wrap)
    return () => ipcRenderer.removeListener(DockerIpc.logsChunk, wrap)
  },
  onEventsChunk(handler: (msg: DockerEventChunk) => void): () => void {
    const wrap = (_e: Electron.IpcRendererEvent, msg: unknown) => {
      const m = msg as DockerEventChunk
      if (m && typeof m.subscriptionId === 'string' && typeof m.line === 'string') handler(m)
    }
    ipcRenderer.on(DockerIpc.eventsChunk, wrap)
    return () => ipcRenderer.removeListener(DockerIpc.eventsChunk, wrap)
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
