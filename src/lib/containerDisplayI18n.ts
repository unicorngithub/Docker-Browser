import type { TFunction } from 'i18next'

/** Docker 常见 `State` 字段（小写） */
const KNOWN_STATES = new Set([
  'created',
  'restarting',
  'running',
  'removing',
  'paused',
  'exited',
  'dead',
])

export function localizeContainerState(
  state: string | undefined,
  t: TFunction<'translation', undefined>,
): string {
  if (!state?.trim()) return '—'
  const key = state.trim().toLowerCase()
  if (!KNOWN_STATES.has(key)) {
    return t('containers.stateValues.other', { raw: state.trim() })
  }
  return t(`containers.stateValues.${key}`)
}

function isZh(lng: string): boolean {
  return lng === 'zh-CN' || lng.startsWith('zh')
}

/**
 * 将 Docker 返回的英文时间片段转为中文（仅 zh 界面使用；英文界面保持原文）。
 */
export function translateDockerTimePhraseEnToZh(phrase: string): string {
  let s = phrase.trim()
  if (!s) return s

  const repl = (pattern: RegExp, replacement: string) => {
    s = s.replace(pattern, replacement)
  }

  repl(/\bless than a second\b/gi, '不到 1 秒')
  repl(/\babout a second\b/gi, '约 1 秒')
  repl(/\babout a minute\b/gi, '约 1 分钟')
  repl(/\babout an hour\b/gi, '约 1 小时')
  repl(/\babout a month\b/gi, '约 1 个月')
  repl(/\babout a year\b/gi, '约 1 年')
  repl(/\ban hour\b/gi, '1 小时')
  repl(/\ba minute\b/gi, '1 分钟')
  repl(/\ba second\b/gi, '1 秒')
  repl(/\ba year\b/gi, '1 年')
  repl(/\ba day\b/gi, '1 天')
  repl(/\ba week\b/gi, '1 周')
  repl(/\ba month\b/gi, '1 个月')

  repl(/\b(\d+)\s+nanoseconds?\b/gi, '$1 纳秒')
  repl(/\b(\d+)\s+microseconds?\b/gi, '$1 微秒')
  repl(/\b(\d+)\s+milliseconds?\b/gi, '$1 毫秒')
  repl(/\b(\d+)\s+seconds?\b/gi, '$1 秒')
  repl(/\b(\d+)\s+minutes?\b/gi, '$1 分钟')
  repl(/\b(\d+)\s+hours?\b/gi, '$1 小时')
  repl(/\b(\d+)\s+days?\b/gi, '$1 天')
  repl(/\b(\d+)\s+weeks?\b/gi, '$1 周')
  repl(/\b(\d+)\s+months?\b/gi, '$1 个月')
  repl(/\b(\d+)\s+years?\b/gi, '$1 年')
  repl(/\bago\b/gi, '前')

  return s.trim()
}

type Parsed =
  | { key: 'upHealthy'; rest: string }
  | { key: 'upUnhealthy'; rest: string }
  | { key: 'upHealthStarting'; rest: string }
  | { key: 'upPaused'; rest: string }
  | { key: 'up'; rest: string }
  | { key: 'exited'; code: string; tail: string }
  | { key: 'restarting'; count?: string; tail: string }
  | { key: 'created' }
  | { key: 'dead' }
  | { key: 'removing' }
  | { key: 'paused' }
  | { key: 'fallback'; raw: string }

function parseDockerStatusLine(status: string): Parsed {
  const s = status.trim()

  const upHealthy = /^Up\s+(.+?)\s+\(healthy\)\s*$/i.exec(s)
  if (upHealthy) return { key: 'upHealthy', rest: upHealthy[1].trim() }

  const upUnhealthy = /^Up\s+(.+?)\s+\(unhealthy\)\s*$/i.exec(s)
  if (upUnhealthy) return { key: 'upUnhealthy', rest: upUnhealthy[1].trim() }

  const upHealth = /^Up\s+(.+?)\s+\(health:\s*starting\)\s*$/i.exec(s)
  if (upHealth) return { key: 'upHealthStarting', rest: upHealth[1].trim() }

  const upPaused = /^Up\s+(.+?)\s+\(paused\)\s*$/i.exec(s)
  if (upPaused) return { key: 'upPaused', rest: upPaused[1].trim() }

  const up = /^Up\s+(.+)$/i.exec(s)
  if (up) return { key: 'up', rest: up[1].trim() }

  const exited = /^Exited\s*\((\d+)\)\s*(.*)$/i.exec(s)
  if (exited) return { key: 'exited', code: exited[1], tail: exited[2].trim() }

  const restarting = /^Restarting\s*(?:\((\d+)\))?\s*(.*)$/i.exec(s)
  if (restarting && restarting[0].toLowerCase().startsWith('restarting')) {
    const count = restarting[1]
    const tail = (restarting[2] ?? '').trim()
    return { key: 'restarting', count, tail }
  }

  if (/^created$/i.test(s)) return { key: 'created' }
  if (/^dead$/i.test(s)) return { key: 'dead' }
  if (/^removing$/i.test(s) || /removal in progress/i.test(s)) return { key: 'removing' }
  if (/^paused$/i.test(s)) return { key: 'paused' }

  return { key: 'fallback', raw: s }
}

export function localizeContainerStatus(
  status: string | undefined,
  t: TFunction<'translation', undefined>,
  resolvedLng: string,
): string {
  if (!status?.trim()) return '—'

  const raw = status.trim()
  const parsed = parseDockerStatusLine(raw)
  const zh = isZh(resolvedLng)

  const maybeZhTime = (fragment: string) => (zh ? translateDockerTimePhraseEnToZh(fragment) : fragment)

  switch (parsed.key) {
    case 'upHealthy':
      return t('containers.statusPattern.upHealthy', { rest: maybeZhTime(parsed.rest) })
    case 'upUnhealthy':
      return t('containers.statusPattern.upUnhealthy', { rest: maybeZhTime(parsed.rest) })
    case 'upHealthStarting':
      return t('containers.statusPattern.upHealthStarting', { rest: maybeZhTime(parsed.rest) })
    case 'upPaused':
      return t('containers.statusPattern.upPaused', { rest: maybeZhTime(parsed.rest) })
    case 'up':
      return t('containers.statusPattern.up', { rest: maybeZhTime(parsed.rest) })
    case 'exited':
      return t('containers.statusPattern.exited', {
        code: parsed.code,
        tail: parsed.tail ? ` ${maybeZhTime(parsed.tail)}` : '',
      })
    case 'restarting':
      return t('containers.statusPattern.restarting', {
        count: parsed.count ? ` (${parsed.count})` : '',
        tail: parsed.tail ? ` ${maybeZhTime(parsed.tail)}` : '',
      })
    case 'created':
      return t('containers.statusPattern.created')
    case 'dead':
      return t('containers.statusPattern.dead')
    case 'removing':
      return t('containers.statusPattern.removing')
    case 'paused':
      return t('containers.statusPattern.paused')
    case 'fallback':
      return t('containers.statusPattern.fallback', { raw: parsed.raw })
  }
}
