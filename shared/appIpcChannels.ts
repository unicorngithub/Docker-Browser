/** 应用壳层 IPC（与 Docker 引擎调用无关） */
export const AppIpc = {
  getAppVersion: 'app:get-app-version',
  checkForUpdates: 'app:check-for-updates',
  quitAndInstall: 'app:quit-and-install',
  /** 主进程 → 渲染进程（preload 用 ipcRenderer.on 订阅） */
  updateStatusEvent: 'app:update-status',
} as const
