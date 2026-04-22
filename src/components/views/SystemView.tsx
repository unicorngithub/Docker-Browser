import { useTranslation } from 'react-i18next'
import { useDockerStore } from '@/stores/dockerStore'

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
  const systemInfo = useDockerStore((s) => s.systemInfo)
  const versionJson = useDockerStore((s) => s.versionJson)
  const diskJson = useDockerStore((s) => s.diskJson)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
      <h2 className="text-sm font-semibold">{t('system.title')}</h2>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        <JsonBlock title={t('system.info')} data={systemInfo} />
        <JsonBlock title={t('system.version')} data={versionJson} />
        <JsonBlock title={t('system.disk')} data={diskJson} />
      </div>
    </div>
  )
}
