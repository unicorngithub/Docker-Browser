import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppDialog } from '@/dialog/AppDialogContext'
import { useDockerStore } from '@/stores/dockerStore'
import { unwrapIpc } from '@/lib/ipc'
import { formatThrownEngineError } from '@/lib/alertMessage'

type Row = {
  Name: string
  Driver?: string
  Mountpoint?: string
}

function shortId(id: string): string {
  return id.replace(/^sha256:/i, '').slice(0, 12)
}

export function VolumesView() {
  const { t } = useTranslation()
  const { alert, confirm } = useAppDialog()
  const volumeList = useDockerStore((s) => s.volumeList) as Row[]
  const busy = useDockerStore((s) => s.busy)
  const selectedVolumeName = useDockerStore((s) => s.selectedVolumeName)
  const setSelectedVolumeName = useDockerStore((s) => s.setSelectedVolumeName)
  const afterMutation = useDockerStore((s) => s.afterMutation)

  const sel = volumeList.find((v) => v.Name === selectedVolumeName) ?? null
  const [volName, setVolName] = useState('')
  const [usedBy, setUsedBy] = useState<string[]>([])
  const [checkedNames, setCheckedNames] = useState<Set<string>>(() => new Set())
  const headerCheckboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!sel) {
      setUsedBy([])
      return
    }
    void window.dockerDesktop.volumeUsedBy(sel.Name).then((res) => {
      if (res.ok) setUsedBy(res.data.containerIds)
      else setUsedBy([])
    })
  }, [sel?.Name])

  useEffect(() => {
    setCheckedNames((prev) => {
      const valid = new Set(volumeList.map((v) => v.Name))
      const next = new Set<string>()
      for (const n of prev) if (valid.has(n)) next.add(n)
      return next
    })
  }, [volumeList])

  const allSelected = useMemo(
    () => volumeList.length > 0 && volumeList.every((v) => checkedNames.has(v.Name)),
    [volumeList, checkedNames],
  )

  useEffect(() => {
    const el = headerCheckboxRef.current
    if (!el) return
    el.indeterminate = checkedNames.size > 0 && !allSelected
  }, [checkedNames, allSelected])

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn()
      await afterMutation()
    } catch (e) {
      const text = formatThrownEngineError(t, e)
      if (text) await alert(text)
    }
  }

  const onRemoveSelected = async () => {
    if (checkedNames.size === 0) return
    if (!(await confirm(t('volumes.removeBulkConfirm', { count: checkedNames.size })))) return
    const names = [...checkedNames]
    const primary = selectedVolumeName
    void run(async () => {
      const failures: string[] = []
      let okCount = 0
      for (const name of names) {
        const row = volumeList.find((x) => x.Name === name)
        if (!row) continue
        try {
          await unwrapIpc(window.dockerDesktop.removeVolume(row.Name))
          okCount++
        } catch {
          failures.push(row.Name)
        }
      }
      setCheckedNames(new Set())
      if (primary && names.includes(primary)) setSelectedVolumeName(null)
      if (failures.length) {
        await alert(
          t('volumes.removePartialResult', {
            ok: okCount,
            failed: failures.length,
            names: failures.slice(0, 12).join(', '),
          }),
        )
      }
    })
  }

  const onCreate = () => {
    const name = volName.trim()
    if (!name) return
    void run(async () => {
      await unwrapIpc(window.dockerDesktop.createVolume({ name }))
      setVolName('')
    })
  }

  const toggleChecked = (name: string, next: boolean) => {
    setCheckedNames((prev) => {
      const n = new Set(prev)
      if (next) n.add(name)
      else n.delete(name)
      return n
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) setCheckedNames(new Set())
    else setCheckedNames(new Set(volumeList.map((v) => v.Name)))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('volumes.title')}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={checkedNames.size === 0 || busy}
            onClick={() => void onRemoveSelected()}
            className="rounded-md border border-rose-400 px-2 py-1 text-[11px] text-rose-800 dark:border-rose-800 dark:text-rose-200"
          >
            {t('volumes.removeSelected')}
          </button>
        </div>
      </div>
      <p className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">{t('volumes.selectionHint')}</p>
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200/70 bg-zinc-50/80 p-2 text-[11px] dark:border-white/[0.06] dark:bg-zinc-900/50">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{t('volumes.create')}</span>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-500">{t('volumes.createName')}</span>
          <input
            value={volName}
            onChange={(e) => setVolName(e.target.value)}
            className="w-48 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <button
          type="button"
          disabled={busy || !volName.trim()}
          onClick={() => void onCreate()}
          className="rounded-md bg-emerald-600 px-2 py-1 font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {t('volumes.createSubmit')}
        </button>
      </div>
      {sel ? (
        <div className="rounded-lg border border-zinc-200/70 bg-white/50 p-2 text-[10px] text-zinc-700 dark:border-white/[0.06] dark:bg-zinc-900/40 dark:text-zinc-300">
          <div className="mb-1 font-medium">{t('volumes.usedBy')}</div>
          {usedBy.length ? (
            <ul className="font-mono">
              {usedBy.map((id) => (
                <li key={id}>{shortId(id)}</li>
              ))}
            </ul>
          ) : (
            <span className="text-zinc-500">—</span>
          )}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200/80 dark:border-white/[0.06]">
        <table className="w-full min-w-[560px] border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-zinc-100/95 text-zinc-600 backdrop-blur dark:bg-zinc-900/95 dark:text-zinc-400">
            <tr>
              <th className="w-9 border-b border-zinc-200 px-1 py-2 dark:border-zinc-800">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  className="align-middle"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  title={t('common.selectAll')}
                  aria-label={t('common.selectAll')}
                />
              </th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.name')}
              </th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.driver')}
              </th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.mount')}
              </th>
            </tr>
          </thead>
          <tbody>
            {volumeList.map((v) => {
              const active = v.Name === selectedVolumeName
              const checked = checkedNames.has(v.Name)
              return (
                <tr
                  key={v.Name}
                  onClick={() => setSelectedVolumeName(v.Name)}
                  className={`cursor-pointer border-b border-zinc-100 hover:bg-sky-500/5 dark:border-zinc-800/80 dark:hover:bg-sky-500/10 ${
                    active ? 'bg-sky-500/10 dark:bg-sky-500/15' : ''
                  }`}
                >
                  <td className="px-1 py-1.5 align-middle" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="align-middle"
                      checked={checked}
                      onChange={(e) => {
                        e.stopPropagation()
                        toggleChecked(v.Name, e.target.checked)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={v.Name}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle font-medium text-zinc-900 dark:text-zinc-100">{v.Name}</td>
                  <td className="px-2 py-1.5 align-middle">{v.Driver ?? '—'}</td>
                  <td className="px-2 py-1.5 align-middle font-mono text-zinc-600 dark:text-zinc-400">{v.Mountpoint ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
