import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const MAX_LINES = 400

function formatEventLine(line: string): string {
  try {
    const o = JSON.parse(line) as Record<string, unknown>
    const type = typeof o.Type === 'string' ? o.Type : '?'
    const action = typeof o.Action === 'string' ? o.Action : '?'
    const actor = o.Actor as Record<string, unknown> | undefined
    const id =
      typeof actor?.ID === 'string'
        ? actor.ID.slice(0, 12)
        : typeof o.id === 'string'
          ? o.id.slice(0, 12)
          : ''
    const name =
      actor?.Attributes && typeof (actor.Attributes as Record<string, unknown>).name === 'string'
        ? String((actor.Attributes as Record<string, unknown>).name)
        : ''
    return `[${type}] ${action} ${id}${name ? ` ${name}` : ''}`
  } catch {
    return line
  }
}

export function EventsView() {
  const { t } = useTranslation()
  const [lines, setLines] = useState<string[]>([])
  const [subId, setSubId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const subRef = useRef<string | null>(null)

  useEffect(() => {
    subRef.current = subId
  }, [subId])

  const stop = useCallback(async () => {
    const id = subRef.current
    if (!id) return
    await window.dockerDesktop.stopEvents(id)
    subRef.current = null
    setSubId(null)
    setRunning(false)
  }, [])

  useEffect(() => {
    return () => {
      const id = subRef.current
      if (id) void window.dockerDesktop.stopEvents(id)
    }
  }, [])

  useEffect(() => {
    if (!subId) return
    const unsub = window.dockerDesktop.onEventsChunk((msg) => {
      if (msg.subscriptionId !== subId) return
      setLines((prev) => {
        const next = [...prev, formatEventLine(msg.line)]
        if (next.length > MAX_LINES) return next.slice(-MAX_LINES)
        return next
      })
    })
    return () => unsub()
  }, [subId])

  const start = async () => {
    await stop()
    setLines([])
    const sinceUnix = Math.floor(Date.now() / 1000) - 120
    const res = await window.dockerDesktop.startEvents({ sinceUnix })
    if (!res.ok) {
      window.alert(res.error)
      return
    }
    subRef.current = res.data.subscriptionId
    setSubId(res.data.subscriptionId)
    setRunning(true)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t('events.title')}</h2>
          <p className="mt-0.5 text-[10px] text-zinc-500">{t('events.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={running}
            onClick={() => void start()}
            className="rounded-md bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {t('events.start')}
          </button>
          <button
            type="button"
            disabled={!running}
            onClick={() => void stop()}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] dark:border-zinc-600 dark:bg-zinc-900"
          >
            {t('events.stop')}
          </button>
          <button
            type="button"
            onClick={() => setLines([])}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] dark:border-zinc-600 dark:bg-zinc-900"
          >
            {t('events.clear')}
          </button>
        </div>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200/80 bg-zinc-100/80 p-2 font-mono text-[10px] leading-relaxed text-zinc-800 dark:border-white/[0.06] dark:bg-black/30 dark:text-zinc-200">
        {lines.length ? lines.join('\n') : t('events.empty')}
      </pre>
    </div>
  )
}
