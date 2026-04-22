import { app, BrowserWindow, ipcMain } from 'electron'
import type { AppLanguage } from '../../shared/locale'
import type { ThemePreference } from '../../shared/theme'
import { ipcErr, ipcOk, type IpcResult } from '../../shared/ipc'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { installAppMenu, syncNativeThemeSource } from './appMenu'
import { openExternalUrlIfAllowed } from './openExternalPolicy'
import { registerDockerIpc } from './ipcDocker'

registerDockerIpc()

ipcMain.handle(
  'app:get-docker-runtime-env',
  async (): Promise<IpcResult<{ dockerHost: string; dockerContext: string }>> => {
    return ipcOk({
      dockerHost: process.env.DOCKER_HOST ?? '',
      dockerContext: process.env.DOCKER_CONTEXT ?? '',
    })
  },
)

ipcMain.handle('app:get-compose-version', async (): Promise<IpcResult<string>> => {
  try {
    const r = spawnSync('docker', ['compose', 'version'], {
      encoding: 'utf8',
      timeout: 12_000,
    })
    if (r.error) return ipcErr(r.error.message)
    if (r.status !== 0) {
      const msg = (r.stderr || r.stdout || '').trim() || 'docker compose failed'
      return ipcErr(msg)
    }
    return ipcOk((r.stdout || '').trim() || 'ok')
  } catch (e) {
    return ipcErr(e instanceof Error ? e.message : String(e))
  }
})

ipcMain.on('app:theme-preference-changed', (_, pref: unknown) => {
  if (pref !== 'light' && pref !== 'dark' && pref !== 'system') return
  const p = pref as ThemePreference
  syncNativeThemeSource(p)
  installAppMenu(p)
})

ipcMain.on('app:language-changed', (_, lng: unknown) => {
  if (lng !== 'en' && lng !== 'zh-CN') return
  installAppMenu(undefined, lng as AppLanguage)
})

app.setName('Docker Browser')

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

function createLogWindow(containerId: string) {
  const logWin = new BrowserWindow({
    title: 'Docker Browser',
    width: 920,
    height: 640,
    minWidth: 400,
    minHeight: 280,
    icon: path.join(process.env.VITE_PUBLIC ?? '', 'icon.png'),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const hash = `logs?containerId=${encodeURIComponent(containerId)}`
  if (VITE_DEV_SERVER_URL) {
    void logWin.loadURL(`${VITE_DEV_SERVER_URL}#${hash}`)
  } else {
    void logWin.loadFile(indexHtml, { hash })
  }

  logWin.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrlIfAllowed(url)
    return { action: 'deny' }
  })
}

ipcMain.handle('app:open-container-logs-window', (_evt, containerId: unknown) => {
  if (typeof containerId !== 'string' || !containerId.trim()) return Promise.resolve(ipcErr('invalid container id'))
  try {
    createLogWindow(containerId.trim())
    return Promise.resolve(ipcOk(undefined))
  } catch (e) {
    return Promise.resolve(ipcErr(e instanceof Error ? e.message : String(e)))
  }
})

async function createWindow() {
  win = new BrowserWindow({
    title: 'Docker Browser',
    width: 1240,
    height: 780,
    minWidth: 960,
    minHeight: 560,
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(indexHtml)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrlIfAllowed(url)
    return { action: 'deny' }
  })

  win.once('closed', () => {
    win = null
  })
}

app.whenReady().then(() => {
  installAppMenu()
  createWindow()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  const w = win ?? BrowserWindow.getAllWindows()[0]
  if (w && !w.isDestroyed()) {
    if (w.isMinimized()) w.restore()
    w.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})
