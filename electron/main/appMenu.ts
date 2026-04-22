import { app, BrowserWindow, Menu, nativeTheme, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { openExternalUrlIfAllowed } from './openExternalPolicy'
import {
  DOCKER_BROWSER_REPOSITORY_URL,
  escapeHtml,
  formatAboutWindowBodyHtml,
  getAppShellStrings,
  interpolateTemplate,
  type AppShellStrings,
} from '../../shared/appShellStrings'
import type { AppLanguage } from '../../shared/locale'
import { getDefaultAppLanguage } from '../../shared/locale'
import type { ThemePreference } from '../../shared/theme'

export function syncNativeThemeSource(pref: ThemePreference): void {
  nativeTheme.themeSource = pref === 'system' ? 'system' : pref
}

let menuTheme: ThemePreference = 'system'
let menuLang: AppLanguage = getDefaultAppLanguage()

function shellStrings(): AppShellStrings {
  return getAppShellStrings(menuLang)
}

function sendThemeToRenderer(pref: ThemePreference): void {
  const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (w && !w.isDestroyed()) w.webContents.send('app-menu:theme', pref)
}

function openDockerEngineDocs(): void {
  void shell.openExternal('https://docs.docker.com/engine/api/latest/')
}

function openSourceRepository(): void {
  void shell.openExternal(DOCKER_BROWSER_REPOSITORY_URL)
}

let aboutBrowserWindow: BrowserWindow | null = null

function openNonMacAboutWindow(): void {
  const s = shellStrings()
  if (aboutBrowserWindow && !aboutBrowserWindow.isDestroyed()) {
    aboutBrowserWindow.focus()
    return
  }

  const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const bodyHtml = formatAboutWindowBodyHtml(s, app.getVersion())
  const titleEscaped = escapeHtml(s.aboutDialogTitle)
  const okEscaped = escapeHtml(s.dialogOk)

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>${titleEscaped}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif;
    -webkit-font-smoothing: antialiased;
    font-size: 13px;
    line-height: 1.6;
    color: #18181b;
    background: #fafafa;
  }
  .shell { display: flex; align-items: flex-start; justify-content: center; padding: 26px 12px 0; }
  .card { width: 100%; max-width: 420px; padding: 4px 14px 0; }
  .eyebrow { margin: 0 0 6px; font-size: 10px; font-weight: 600; letter-spacing: 0.25em; text-transform: uppercase; color: #0891b2; }
  .title { margin: 0 0 14px; font-size: 1.15rem; font-weight: 600; color: #09090b; }
  .content p { margin: 0 0 12px; color: #52525b; }
  .content p.meta { font-size: 12px; color: #71717a; }
  .content p.repo { font-size: 12px; color: #52525b; }
  a.repo-link { color: #0e7490; text-decoration: none; border-bottom: 1px solid rgba(8, 145, 178, 0.35); }
  .footer { margin-top: 16px; display: flex; justify-content: flex-end; }
  button#ok { font-size: 13px; padding: 5px 16px; border: 1px solid #d4d4d8; border-radius: 8px; cursor: pointer; background: #fafafa; }
  @media (prefers-color-scheme: dark) {
    body { background: #09090b; color: #f4f4f5; }
    .title { color: #fafafa; }
    .content p { color: #a1a1aa; }
    a.repo-link { color: #67e8f9; }
    button#ok { color: #e4e4e7; background: #27272a; border-color: #3f3f46; }
  }
</style>
</head>
<body>
  <div class="shell">
    <div class="card">
      <p class="eyebrow">Docker Browser</p>
      <h1 class="title">${titleEscaped}</h1>
      <div class="content">${bodyHtml}</div>
      <div class="footer"><button type="button" id="ok">${okEscaped}</button></div>
    </div>
  </div>
  <script>
    document.getElementById("ok").addEventListener("click", function () { window.close(); });
  </script>
</body>
</html>`

  const win = new BrowserWindow({
    parent: parent ?? undefined,
    modal: !!parent,
    width: 420,
    height: 260,
    resizable: false,
    show: false,
    title: s.aboutDialogTitle,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })

  aboutBrowserWindow = win
  win.on('closed', () => {
    if (aboutBrowserWindow === win) aboutBrowserWindow = null
  })

  win.webContents.on('will-navigate', (e, url) => {
    if (openExternalUrlIfAllowed(url)) e.preventDefault()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrlIfAllowed(url)
    return { action: 'deny' }
  })

  win.webContents.once('did-finish-load', () => {
    win.show()
  })
  void win.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`)
}

function showAbout(): void {
  if (process.platform === 'darwin') {
    app.showAboutPanel()
    return
  }
  openNonMacAboutWindow()
}

function broadcastAppLanguage(lng: AppLanguage): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('app-menu:language', lng)
  }
}

export function installAppMenu(themePref?: ThemePreference, language?: AppLanguage): void {
  if (themePref !== undefined) menuTheme = themePref
  if (language !== undefined) menuLang = language

  const s = shellStrings()
  const isMac = process.platform === 'darwin'

  app.setAboutPanelOptions({
    applicationName: 'Docker Browser',
    applicationVersion: app.getVersion(),
    copyright: s.aboutPanelCopyright,
    website: DOCKER_BROWSER_REPOSITORY_URL,
  })

  const macAppMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about', label: interpolateTemplate(s.macAboutApp, { appName: app.name }) },
      { type: 'separator' },
      { role: 'hide', label: interpolateTemplate(s.macHideApp, { appName: app.name }) },
      { role: 'hideOthers', label: s.macHideOthers },
      { role: 'unhide', label: s.macShowAll },
      { type: 'separator' },
      { role: 'quit', label: s.quit },
    ],
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [macAppMenu] : []),
    {
      label: s.file,
      submenu: [
        isMac
          ? { label: s.closeWindow, role: 'close', accelerator: 'Cmd+W' }
          : { label: s.quit, role: 'quit', accelerator: 'Ctrl+Q' },
      ],
    },
    {
      label: s.edit,
      submenu: [
        { label: s.undo, role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { label: s.redo, role: 'redo', accelerator: 'Shift+CmdOrCtrl+Z' },
        { type: 'separator' },
        { label: s.cut, role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { label: s.copy, role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { label: s.paste, role: 'paste', accelerator: 'CmdOrCtrl+V' },
      ],
    },
    {
      label: s.view,
      submenu: [
        { label: s.reload, role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { type: 'separator' },
        { label: s.actualSize, role: 'resetZoom' },
        { label: s.zoomIn, role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: s.zoomOut, role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { type: 'separator' },
        {
          label: s.toggleFullscreen,
          role: 'togglefullscreen',
          accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11',
        },
      ],
    },
    {
      label: s.settings,
      submenu: [
        {
          label: s.appearance,
          submenu: [
            {
              label: s.themeLight,
              type: 'radio',
              checked: menuTheme === 'light',
              click: () => {
                syncNativeThemeSource('light')
                installAppMenu('light')
                sendThemeToRenderer('light')
              },
            },
            {
              label: s.themeDark,
              type: 'radio',
              checked: menuTheme === 'dark',
              click: () => {
                syncNativeThemeSource('dark')
                installAppMenu('dark')
                sendThemeToRenderer('dark')
              },
            },
            {
              label: s.themeSystem,
              type: 'radio',
              checked: menuTheme === 'system',
              click: () => {
                syncNativeThemeSource('system')
                installAppMenu('system')
                sendThemeToRenderer('system')
              },
            },
          ],
        },
        {
          label: s.languageLabel,
          submenu: [
            {
              label: s.languageEnglish,
              type: 'radio',
              checked: menuLang === 'en',
              click: () => {
                installAppMenu(menuTheme, 'en')
                broadcastAppLanguage('en')
              },
            },
            {
              label: s.languageZhCN,
              type: 'radio',
              checked: menuLang === 'zh-CN',
              click: () => {
                installAppMenu(menuTheme, 'zh-CN')
                broadcastAppLanguage('zh-CN')
              },
            },
          ],
        },
      ],
    },
    ...(isMac
      ? [
          {
            label: s.window,
            submenu: [
              { label: s.minimize, role: 'minimize', accelerator: 'Cmd+M' },
              { label: s.zoom, role: 'zoom' },
              { type: 'separator' as const },
              { role: 'front' as const, label: s.bringAllToFront },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: s.help,
      submenu: [
        { label: s.dockerEngineDocs, click: openDockerEngineDocs },
        { type: 'separator' },
        { label: s.helpOpenSourceRepository, click: openSourceRepository },
        { type: 'separator' },
        ...(!isMac ? [{ label: s.aboutAppMenu, click: showAbout }] : []),
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
