import { shell } from 'electron'

function isHttpLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1'
}

export function openExternalUrlIfAllowed(rawUrl: string): boolean {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return false
  }

  if (u.protocol === 'https:') {
    void shell.openExternal(rawUrl)
    return true
  }

  if (u.protocol === 'http:' && isHttpLoopbackHost(u.hostname)) {
    void shell.openExternal(rawUrl)
    return true
  }

  return false
}
