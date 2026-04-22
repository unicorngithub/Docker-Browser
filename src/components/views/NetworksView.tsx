import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppDialog } from '@/dialog/AppDialogContext'
import { useDockerStore } from '@/stores/dockerStore'
import { unwrapIpc } from '@/lib/ipc'

type Row = {
  Id: string
  Name?: string
  Driver?: string
  Scope?: string
}

function shortId(id: string): string {
  return id.slice(0, 12)
}

export function NetworksView() {
  const { t } = useTranslation()
  const { alert, confirm } = useAppDialog()
  const networks = useDockerStore((s) => s.networks) as Row[]
  const busy = useDockerStore((s) => s.busy)
  const selectedNetworkId = useDockerStore((s) => s.selectedNetworkId)
  const setSelectedNetworkId = useDockerStore((s) => s.setSelectedNetworkId)
  const afterMutation = useDockerStore((s) => s.afterMutation)
  const containers = useDockerStore((s) => s.containers) as { Id: string; Names?: string[] }[]

  const sel = networks.find((n) => n.Id === selectedNetworkId) ?? null
  const [netName, setNetName] = useState('')
  const [netDriver, setNetDriver] = useState('bridge')
  const [connectCid, setConnectCid] = useState('')

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
    if (!(await confirm(t('networks.removeConfirm')))) return
    void run(async () => {
      await unwrapIpc(window.dockerDesktop.removeNetwork(sel.Id))
      setSelectedNetworkId(null)
    })
  }

  const onCreate = () => {
    const name = netName.trim()
    if (!name) return
    void run(async () => {
      await unwrapIpc(
        window.dockerDesktop.createNetwork({ name, driver: netDriver.trim() || 'bridge' }),
      )
      setNetName('')
    })
  }

  const onPrune = () => {
    void run(async () => {
      if (!(await confirm(t('networks.pruneConfirm')))) return
      await unwrapIpc(window.dockerDesktop.pruneNetworks())
    })
  }

  const onConnect = () => {
    if (!sel) return
    const containerId = connectCid.trim()
    if (!containerId) return
    void run(async () => {
      await unwrapIpc(window.dockerDesktop.networkConnect({ networkId: sel.Id, containerId }))
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('networks.title')}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!sel || busy}
            onClick={() => void onRemove()}
            className="rounded-md border border-rose-400 px-2 py-1 text-[11px] text-rose-800 dark:border-rose-800 dark:text-rose-200"
          >
            {t('networks.remove')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPrune()}
            className="rounded-md border border-amber-400 px-2 py-1 text-[11px] text-amber-950 dark:border-amber-800 dark:text-amber-100"
          >
            {t('networks.prune')}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200/70 bg-zinc-50/80 p-2 text-[11px] dark:border-white/[0.06] dark:bg-zinc-900/50">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{t('networks.create')}</span>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-500">{t('networks.createName')}</span>
          <input
            value={netName}
            onChange={(e) => setNetName(e.target.value)}
            className="w-40 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-500">{t('networks.createDriver')}</span>
          <input
            value={netDriver}
            onChange={(e) => setNetDriver(e.target.value)}
            className="w-32 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <button
          type="button"
          disabled={busy || !netName.trim()}
          onClick={() => void onCreate()}
          className="rounded-md bg-emerald-600 px-2 py-1 font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {t('networks.createSubmit')}
        </button>
      </div>
      {sel ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-sky-200/70 bg-sky-50/50 p-2 text-[11px] dark:border-sky-900/40 dark:bg-sky-950/20">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{t('networks.connect')}</span>
          <select
            value={connectCid}
            onChange={(e) => setConnectCid(e.target.value)}
            className="max-w-xs rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-[10px] dark:border-zinc-600 dark:bg-zinc-950"
          >
            <option value="">{t('networks.connectPick')}</option>
            {containers.map((c) => (
              <option key={c.Id} value={c.Id}>
                {(c.Names?.[0] ?? c.Id).replace(/^\//, '')} · {shortId(c.Id)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !connectCid}
            onClick={() => void onConnect()}
            className="rounded-md bg-sky-600 px-2 py-1 font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {t('networks.connectRun')}
          </button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200/80 dark:border-white/[0.06]">
        <table className="w-full min-w-[560px] border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-zinc-100/95 text-zinc-600 backdrop-blur dark:bg-zinc-900/95 dark:text-zinc-400">
            <tr>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.name')}
              </th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.id')}
              </th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.driver')}
              </th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.scope')}
              </th>
            </tr>
          </thead>
          <tbody>
            {networks.map((n) => {
              const active = n.Id === selectedNetworkId
              return (
                <tr
                  key={n.Id}
                  onClick={() => setSelectedNetworkId(n.Id)}
                  className={`cursor-pointer border-b border-zinc-100 hover:bg-sky-500/5 dark:border-zinc-800/80 dark:hover:bg-sky-500/10 ${
                    active ? 'bg-sky-500/10 dark:bg-sky-500/15' : ''
                  }`}
                >
                  <td className="px-2 py-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                    {n.Name ?? '—'}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-zinc-600 dark:text-zinc-400">{shortId(n.Id)}</td>
                  <td className="px-2 py-1.5">{n.Driver ?? '—'}</td>
                  <td className="px-2 py-1.5">{n.Scope ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
