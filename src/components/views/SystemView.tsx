import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppDialog } from '@/dialog/AppDialogContext'
import { alertEngineError, formatThrownEngineError } from '@/lib/alertMessage'
import { useDockerStore } from '@/stores/dockerStore'
import { unwrapIpc } from '@/lib/ipc'

function JsonBlock({ title, data }: { title: string; data: unknown }) {
  const str =
    data === null || data === undefined ? '{}' : JSON.stringify(data, null, 2)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <h3 className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">{title}</h3>
      <pre className="max-h-72 min-h-[120px] flex-1 overflow-auto rounded-lg border border-zinc-200/80 bg-zinc-100/80 p-2 font-mono text-[10px] text-zinc-800 dark:border-white/[0.06] dark:bg-black/30 dark:text-zinc-200">
        {str}
      </pre>
    </div>
  )
}

export function SystemView() {
  const { t } = useTranslation()
  const { alert } = useAppDialog()
  const systemInfo = useDockerStore((s) => s.systemInfo)
  const versionJson = useDockerStore((s) => s.versionJson)
  const diskJson = useDockerStore((s) => s.diskJson)
  const afterMutation = useDockerStore((s) => s.afterMutation)
  const ping = useDockerStore((s) => s.ping)
  const [composeOut, setComposeOut] = useState<string>('')
  const [runtimeEnv, setRuntimeEnv] = useState<{ dockerHost: string; dockerContext: string } | null>(
    null,
  )

  useEffect(() => {
    void window.dockerDesktop.getDockerRuntimeEnv().then((res) => {
      if (res.ok) setRuntimeEnv(res.data)
    })
  }, [])

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn()
      await afterMutation()
    } catch (e) {
      const text = formatThrownEngineError(t, e)
      if (text) await alert(text)
    }
  }

  const refreshCompose = () => {
    void window.dockerDesktop.getComposeVersion().then(async (res) => {
      if (!res.ok) {
        setComposeOut('—')
        await alertEngineError(alert, t, res.error)
        return
      }
      setComposeOut(res.data)
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden p-4">
      <h2 className="text-sm font-semibold">{t('system.title')}</h2>

      <section className="rounded-lg border border-zinc-200/80 bg-white/60 p-3 dark:border-white/[0.06] dark:bg-zinc-900/40">
        <h3 className="mb-2 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
          {t('system.maintenanceTitle')}
        </h3>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-sky-400 px-2 py-1 text-[10px] dark:border-sky-800"
            title={t('system.reconnectDockerHint')}
            onClick={() =>
              void run(async () => {
                await unwrapIpc(window.dockerDesktop.reconnectDocker())
                await ping()
              })
            }
          >
            {t('system.reconnectDocker')}
          </button>
        </div>
        <div className="grid gap-3 text-[10px] text-zinc-600 dark:text-zinc-400 md:grid-cols-2">
          <div>
            <div className="mb-1 font-medium text-zinc-700 dark:text-zinc-300">
              {t('system.composeVersion')}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-0.5 dark:border-zinc-600"
                onClick={() => refreshCompose()}
              >
                {t('system.composeRefresh')}
              </button>
              <span className="font-mono text-[10px] text-zinc-800 dark:text-zinc-200">{composeOut || '—'}</span>
            </div>
          </div>
          <div>
            <div className="mb-1 font-medium text-zinc-700 dark:text-zinc-300">{t('system.runtimeEnv')}</div>
            <pre className="whitespace-pre-wrap rounded border border-zinc-200/80 bg-zinc-50/80 p-2 font-mono dark:border-zinc-700 dark:bg-black/20">
              {runtimeEnv
                ? `DOCKER_HOST=${runtimeEnv.dockerHost || '(empty)'}\nDOCKER_CONTEXT=${runtimeEnv.dockerContext || '(empty)'}`
                : '—'}
            </pre>
          </div>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-500">
          {t('system.swarmNote')}
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-500">{t('system.tlsNote')}</p>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        <JsonBlock title={t('system.info')} data={systemInfo} />
        <JsonBlock title={t('system.version')} data={versionJson} />
        <JsonBlock title={t('system.disk')} data={diskJson} />
      </div>
    </div>
  )
}
