import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeRestartPolicyName, type RestartPolicyName } from '@shared/restartPolicy'
import { RestartPolicyField } from '@/components/RestartPolicyField'
import { useAppDialog } from '@/dialog/AppDialogContext'

type Props = {
  open: boolean
  containerId: string
  onClose: () => void
  onSaved: () => void
}

export function EditContainerRuntimeModal({ open, containerId, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const { alert } = useAppDialog()
  const [name, setName] = useState('')
  const [autoRemove, setAutoRemove] = useState(false)
  const [restartPolicy, setRestartPolicy] = useState<RestartPolicyName>('no')
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !containerId) return
    setLoadErr(null)
    setSubmitting(false)
    void window.dockerDesktop.inspectContainer(containerId).then((res) => {
      if (!res.ok) {
        setLoadErr(res.error)
        return
      }
      const ins = res.data as Record<string, unknown>
      const hc = ins.HostConfig as Record<string, unknown> | undefined
      setName(typeof ins.Name === 'string' ? ins.Name.replace(/^\//, '') : '')
      setAutoRemove(hc?.AutoRemove === true)
      const rp = hc?.RestartPolicy as { Name?: string } | undefined
      setRestartPolicy(normalizeRestartPolicyName(typeof rp?.Name === 'string' ? rp.Name : undefined))
    })
  }, [open, containerId])

  if (!open) return null

  const submit = async () => {
    setSubmitting(true)
    try {
      const res = await window.dockerDesktop.patchContainerRuntime({
        containerId,
        name: name.trim(),
        restartPolicy,
      })
      if (!res.ok) throw new Error(res.error)
      onSaved()
      onClose()
    } catch (e) {
      await alert(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-labelledby="edit-container-runtime-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="edit-container-runtime-title"
          className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
        >
          {t('containers.configRuntimeTitle')}
        </h2>
        <p className="mb-3 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {t('containers.configRuntimeHint')}
        </p>
        {loadErr ? (
          <p className="mb-3 text-[11px] text-rose-700 dark:text-rose-300">{loadErr}</p>
        ) : null}
        <div className="flex flex-col gap-2.5">
          <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
            {t('create.name')}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!loadErr}
              placeholder={t('create.namePlaceholder')}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
          <RestartPolicyField
            value={restartPolicy}
            onChange={setRestartPolicy}
            disabled={autoRemove}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!!loadErr || submitting}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {submitting ? t('common.loading') : t('containers.configRuntimeSubmit')}
          </button>
        </div>
      </div>
    </div>
  )
}
