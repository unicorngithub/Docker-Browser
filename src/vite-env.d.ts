/// <reference types="vite/client" />

import type { DockerEventChunk } from '../shared/dockerEvents'
import type { DockerLogsChunk } from '../shared/dockerLogs'
import type { IpcResult } from '../shared/ipc'
import type { AppLanguage } from '../shared/locale'
import type { ThemePreference } from '../shared/theme'

export interface DockerDesktopApi {
  ping(): Promise<IpcResult<string>>
  info(): Promise<IpcResult<unknown>>
  version(): Promise<IpcResult<unknown>>
  df(): Promise<IpcResult<unknown>>
  listContainers(opts?: { all?: boolean }): Promise<IpcResult<unknown[]>>
  inspectContainer(id: string): Promise<IpcResult<unknown>>
  startContainer(id: string): Promise<IpcResult<void>>
  stopContainer(id: string): Promise<IpcResult<void>>
  restartContainer(id: string): Promise<IpcResult<void>>
  killContainer(id: string): Promise<IpcResult<void>>
  pauseContainer(id: string): Promise<IpcResult<void>>
  unpauseContainer(id: string): Promise<IpcResult<void>>
  removeContainer(payload: { id: string; force?: boolean; v?: boolean }): Promise<IpcResult<void>>
  listImages(): Promise<IpcResult<unknown[]>>
  inspectImage(name: string): Promise<IpcResult<unknown>>
  removeImage(payload: { name: string; force?: boolean; noprune?: boolean }): Promise<IpcResult<unknown[]>>
  pullImage(repoTag: string): Promise<IpcResult<void>>
  createRunContainer(payload: {
    image: string
    name?: string
    envText?: string
    publishText?: string
    cmdText?: string
    autoRemove?: boolean
    restartPolicy?: string
  }): Promise<IpcResult<{ id: string }>>
  recreateContainer(payload: {
    containerId: string
    image: string
    name?: string
    envText?: string
    publishText?: string
    cmdText?: string
    autoRemove?: boolean
    restartPolicy?: string
  }): Promise<IpcResult<{ id: string }>>
  patchContainerRuntime(payload: {
    containerId: string
    name?: string
    restartPolicy?: string
  }): Promise<IpcResult<void>>
  tagImage(payload: { source: string; repo: string; tag?: string }): Promise<IpcResult<void>>
  execOnce(payload: { containerId: string; command: string }): Promise<
    IpcResult<{ output: string; exitCode?: number }>
  >
  startEvents(opts?: { sinceUnix?: number }): Promise<IpcResult<{ subscriptionId: string }>>
  stopEvents(subscriptionId: string): Promise<IpcResult<void>>
  listNetworks(): Promise<IpcResult<unknown[]>>
  removeNetwork(id: string): Promise<IpcResult<void>>
  listVolumes(): Promise<IpcResult<unknown>>
  removeVolume(name: string): Promise<IpcResult<void>>
  startLogs(opts: { containerId: string; tail?: number; timestamps?: boolean }): Promise<
    IpcResult<{ subscriptionId: string }>
  >
  stopLogs(subscriptionId: string): Promise<IpcResult<void>>
  openContainerLogsWindow(containerId: string): Promise<IpcResult<void>>
  openEngineDocs(): Promise<IpcResult<void>>
  onLogsChunk(handler: (msg: DockerLogsChunk) => void): () => void
  onEventsChunk(handler: (msg: DockerEventChunk) => void): () => void
}

export interface AppThemeApi {
  notifyPreferenceChanged(pref: ThemePreference): void
  onMenuSelect(handler: (pref: ThemePreference) => void): () => void
}

export interface AppLocaleApi {
  notifyLanguageChanged(lng: AppLanguage): void
  onMenuLanguageSelect(handler: (lng: AppLanguage) => void): () => void
}

declare global {
  interface Window {
    dockerDesktop: DockerDesktopApi
    appTheme?: AppThemeApi
    appLocale?: AppLocaleApi
  }
}

export {}
