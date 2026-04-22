import { useTranslation } from 'react-i18next'
import { useAppDialog } from '@/dialog/AppDialogContext'
import { useDockerStore } from '@/stores/dockerStore'
import { unwrapIpc } from '@/lib/ipc'

type Row = {
  Name: string
  Driver?: string
  Mountpoint?: string
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

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn()
      await afterMutation()
    } catch (e) {
      await alert(e instanceof Error ? e.message : String(e))
    }
  }

  const onRemove = async () => {
    if (!sel) return
    if (!(await confirm(t('volumes.removeConfirm')))) return
    void run(async () => {
      await unwrapIpc(window.dockerDesktop.removeVolume(sel.Name))
      setSelectedVolumeName(null)
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('volumes.title')}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!sel || busy}
            onClick={() => void onRemove()}
            className="rounded-md border border-rose-400 px-2 py-1 text-[11px] text-rose-800 dark:border-rose-800 dark:text-rose-200"
          >
            {t('common.removeVol')}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200/80 dark:border-white/[0.06]">
        <table className="w-full min-w-[560px] border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-zinc-100/95 text-zinc-600 backdrop-blur dark:bg-zinc-900/95 dark:text-zinc-400">
            <tr>
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
              return (
                <tr
                  key={v.Name}
                  onClick={() => setSelectedVolumeName(v.Name)}
                  className={`cursor-pointer border-b border-zinc-100 hover:bg-sky-500/5 dark:border-zinc-800/80 dark:hover:bg-sky-500/10 ${
                    active ? 'bg-sky-500/10 dark:bg-sky-500/15' : ''
                  }`}
                >
                  <td className="px-2 py-1.5 font-medium text-zinc-900 dark:text-zinc-100">{v.Name}</td>
                  <td className="px-2 py-1.5">{v.Driver ?? '—'}</td>
                  <td className="px-2 py-1.5 font-mono text-zinc-600 dark:text-zinc-400">{v.Mountpoint ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
