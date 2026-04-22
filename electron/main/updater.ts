import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { AppIpc } from '../../shared/appIpcChannels'
import type { AppUpdateStatus } from '../../shared/appUpdateStatus'
import { ipcErr, ipcOk, type IpcResult } from '../../shared/ipc'

function broadcast(msg: AppUpdateStatus) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(AppIpc.updateStatusEvent, msg)
  }
}

let listenersBound = false

function bindAutoUpdaterEvents() {
  if (listenersBound) return
  listenersBound = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => broadcast({ kind: 'checking' }))
  autoUpdater.on('update-available', (info) => {
    let releaseNotes: string | undefined
    if (typeof info.releaseNotes === 'string' && info.releaseNotes.trim()) releaseNotes = info.releaseNotes
    else if (Array.isArray(info.releaseNotes))
      releaseNotes = info.releaseNotes
        .map((n) => (typeof n === 'object' && n && 'note' in n ? String((n as { note?: string }).note ?? '') : ''))
        .filter(Boolean)
        .join('\n')
    broadcast({ kind: 'available', version: info.version, releaseNotes })
  })
  autoUpdater.on('update-not-available', () => broadcast({ kind: 'not-available' }))
  autoUpdater.on('error', (err) => broadcast({ kind: 'error', message: err.message }))
  autoUpdater.on('download-progress', (p) =>
    broadcast({ kind: 'progress', percent: Math.round(p.percent), transferred: p.transferred, total: p.total }),
  )
  autoUpdater.on('update-downloaded', (info) => broadcast({ kind: 'downloaded', version: info.version }))
}

/** 打包后延迟静默检查（不阻塞启动） */
export function scheduleStartupUpdateCheck() {
  if (!app.isPackaged) return
  bindAutoUpdaterEvents()
  const delayMs = 15_000
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((e) =>
      broadcast({ kind: 'error', message: e instanceof Error ? e.message : String(e) }),
    )
  }, delayMs)
}

export function registerAppUpdaterIpc() {
  ipcMain.handle(AppIpc.getAppVersion, async (): Promise<IpcResult<{ version: string; isPackaged: boolean }>> => {
    return ipcOk({ version: app.getVersion(), isPackaged: app.isPackaged })
  })

  ipcMain.handle(AppIpc.checkForUpdates, async (): Promise<IpcResult<void>> => {
    if (!app.isPackaged) return ipcErr('updates only in packaged app')
    bindAutoUpdaterEvents()
    try {
      await autoUpdater.checkForUpdates()
      return ipcOk(undefined)
    } catch (e) {
      return ipcErr(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle(AppIpc.quitAndInstall, (): IpcResult<void> => {
    if (!app.isPackaged) return ipcErr('not packaged')
    bindAutoUpdaterEvents()
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
    return ipcOk(undefined)
  })
}
