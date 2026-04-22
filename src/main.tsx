import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/i18n/i18n'
import App from './App'
import { ContainerLogsWindowApp } from './ContainerLogsWindowApp'
import { LogWindowErrorView } from './LogWindowErrorView'
import { parseLogWindowHash } from '@/lib/logWindowRoute'
import { ThemeProvider } from '@/theme/ThemeProvider'

import './index.css'

const route = parseLogWindowHash()
let shell: React.ReactNode
if (route.mode === 'logs') {
  shell = <ContainerLogsWindowApp containerId={route.containerId} />
} else if (route.mode === 'logs-error') {
  shell = <LogWindowErrorView />
} else {
  shell = <App />
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>{shell}</ThemeProvider>
  </React.StrictMode>,
)
