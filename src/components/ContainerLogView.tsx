import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const MAX_CHARS = 512_000

type Props = {
  containerId: string
  /** 为 true 时在挂载及 containerId 变化时自动开始拉流 */
  autoStart?: boolean
  className?: string
}

export function ContainerLogView({ containerId, autoStart = false, className = '' }: Props) {
  const { t } = useTranslation()
  const [tail, setTail] = useState(200)
  const [timestamps, setTimestamps] = useState(true)
  const [text, setText] = useState('')
  const [subId, setSubId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)
  const autoScroll = useRef(true)
  const subIdRef = useRef<string | null>(null)
  const tailRef = useRef(tail)
  const tsRef = useRef(timestamps)

  useEffect(() => {
    tailRef.current = tail
  }, [tail])
  useEffect(() => {
    tsRef.current = timestamps
  }, [timestamps])

  useEffect(() => {
    subIdRef.current = subId
  }, [subId])

  const stopInternal = useCallback(async (id: string | null) => {
    if (!id) return
    await window.dockerDesktop.stopLogs(id)
    if (subIdRef.current === id) {
      subIdRef.current = null
      setSubId(null)
      setRunning(false)
    }
  }, [])

  useEffect(() => {
    setText('')
  }, [containerId])

  useEffect(() => {
    return () => {
      const id = subIdRef.current
      if (id) void window.dockerDesktop.stopLogs(id)
      subIdRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!subId) return
    const unsub = window.dockerDesktop.onLogsChunk((msg) => {
      if (msg.subscriptionId !== subId) return
      setText((prev) => {
        const next = prev + msg.text
        if (next.length > MAX_CHARS) return next.slice(-MAX_CHARS)
        return next
      })
    })
    return () => {
      unsub()
    }
  }, [subId])

  useEffect(() => {
    if (!preRef.current || !autoScroll.current) return
    preRef.current.scrollTop = preRef.current.scrollHeight
  }, [text])

  const start = useCallback(async () => {
    const prev = subIdRef.current
    if (prev) await stopInternal(prev)
    setText('')
    const res = await window.dockerDesktop.startLogs({
      containerId,
      tail: tailRef.current,
      timestamps: tsRef.current,
    })
    if (!res.ok) {
      setText((s) => s + `\n[error] ${res.error}\n`)
      return
    }
    subIdRef.current = res.data.subscriptionId
    setSubId(res.data.subscriptionId)
    setRunning(true)
  }, [containerId, stopInternal])

  useEffect(() => {
    if (!autoStart) return
    let cancelled = false
    void (async () => {
      const prev = subIdRef.current
      if (prev) await stopInternal(prev)
      if (cancelled) return
      setText('')
      const res = await window.dockerDesktop.startLogs({
        containerId,
        tail: tailRef.current,
        timestamps: tsRef.current,
      })
      if (cancelled) return
      if (!res.ok) {
        setText((s) => s + `\n[error] ${res.error}\n`)
        return
      }
      subIdRef.current = res.data.subscriptionId
      setSubId(res.data.subscriptionId)
      setRunning(true)
    })()
    return () => {
      cancelled = true
      const id = subIdRef.current
      if (id) void window.dockerDesktop.stopLogs(id)
      subIdRef.current = null
      setSubId(null)
      setRunning(false)
    }
  }, [autoStart, containerId, stopInternal])

  const stop = async () => {
    const id = subIdRef.current
    await stopInternal(id)
  }

  const onScroll = () => {
    const el = preRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    autoScroll.current = nearBottom
  }

  return (
    <section
      className={`flex min-h-0 flex-1 flex-col border-t border-zinc-200/80 bg-zinc-50/90 dark:border-white/[0.06] dark:bg-zinc-950/90 ${className}`}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200/60 px-3 py-2 dark:border-white/[0.06]">
        <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{t('logs.title')}</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] text-zinc-600 dark:text-zinc-400">
            <span>{t('logs.tail')}</span>
            <input
              type="number"
              min={10}
              max={10_000}
              value={tail}
              onChange={(e) => setTail(Number(e.target.value) || 200)}
              className="w-16 rounded border border-zinc-300 bg-white px-1 py-0.5 text-[10px] dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <label className="flex items-center gap-1 text-[10px] text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" checked={timestamps} onChange={(e) => setTimestamps(e.target.checked)} />
            {t('logs.timestamps')}
          </label>
          <button
            type="button"
            disabled={running}
            onClick={() => void start()}
            className="rounded-md bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {t('logs.start')}
          </button>
          <button
            type="button"
            disabled={!running}
            onClick={() => void stop()}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium dark:border-zinc-600 dark:bg-zinc-900"
          >
            {t('logs.stop')}
          </button>
          <button
            type="button"
            onClick={() => setText('')}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium dark:border-zinc-600 dark:bg-zinc-900"
          >
            {t('logs.clear')}
          </button>
        </div>
      </div>
      <pre
        ref={preRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all bg-zinc-100/80 p-2 font-mono text-[10px] leading-relaxed text-zinc-800 dark:bg-black/40 dark:text-zinc-200"
      >
        {text}
      </pre>
    </section>
  )
}
