import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InspectJsonModal } from '@/components/InspectJsonModal'
import { useAppDialog } from '@/dialog/AppDialogContext'
import { useDockerStore } from '@/stores/dockerStore'
import { unwrapIpc } from '@/lib/ipc'

type Row = {
  Id: string
  RepoTags?: string[] | null
  Size?: number
  Created?: number
}

function shortId(id: string): string {
  return id.replace(/^sha256:/, '').slice(0, 12)
}

function formatBytes(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${u[i]}`
}

export function ImagesView() {
  const { t } = useTranslation()
  const { alert, confirm } = useAppDialog()
  const images = useDockerStore((s) => s.images) as Row[]
  const busy = useDockerStore((s) => s.busy)
  const selectedImageRef = useDockerStore((s) => s.selectedImageRef)
  const setSelectedImageRef = useDockerStore((s) => s.setSelectedImageRef)
  const afterMutation = useDockerStore((s) => s.afterMutation)
  const [pullTag, setPullTag] = useState('nginx:latest')
  const [pulling, setPulling] = useState(false)
  const [tagRepo, setTagRepo] = useState('my-app')
  const [tagTag, setTagTag] = useState('latest')
  const [tagging, setTagging] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyText, setHistoryText] = useState('[]')

  const sel = images.find((im) => im.Id === selectedImageRef) ?? null
  const imageNameForApi = sel?.RepoTags?.[0] ?? sel?.Id ?? ''

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn()
      await afterMutation()
    } catch (e) {
      await alert(e instanceof Error ? e.message : String(e))
    }
  }

  const onPull = () => {
    const tag = pullTag.trim()
    if (!tag) return
    void run(async () => {
      setPulling(true)
      try {
        await unwrapIpc(window.dockerDesktop.pullImage(tag))
      } finally {
        setPulling(false)
      }
    })
  }

  const onRemove = async () => {
    if (!sel || !imageNameForApi) return
    if (!(await confirm(t('images.removeConfirm')))) return
    void run(async () => {
      await unwrapIpc(window.dockerDesktop.removeImage({ name: imageNameForApi, force: false }))
      setSelectedImageRef(null)
    })
  }

  const onTag = () => {
    if (!sel || !imageNameForApi) return
    const repo = tagRepo.trim()
    if (!repo) return
    void run(async () => {
      setTagging(true)
      try {
        await unwrapIpc(
          window.dockerDesktop.tagImage({
            source: imageNameForApi,
            repo,
            tag: tagTag.trim() || 'latest',
          }),
        )
      } finally {
        setTagging(false)
      }
    })
  }

  const onPruneDangling = () => {
    void run(async () => {
      if (!(await confirm(t('images.pruneDanglingConfirm')))) return
      await unwrapIpc(window.dockerDesktop.pruneImages({ danglingOnly: true }))
    })
  }

  const onSaveTar = () => {
    if (!imageNameForApi) return
    void run(async () => {
      const res = await window.dockerDesktop.saveImageTar({ name: imageNameForApi })
      if (!res.ok) throw new Error(res.error)
      await alert(res.data.filePath)
    })
  }

  const onLoadTar = () => {
    void run(async () => {
      await unwrapIpc(window.dockerDesktop.loadImageTar())
    })
  }

  const onHistory = () => {
    if (!imageNameForApi) return
    void run(async () => {
      const res = await window.dockerDesktop.imageHistory(imageNameForApi)
      if (!res.ok) throw new Error(res.error)
      setHistoryText(JSON.stringify(res.data, null, 2))
      setHistoryOpen(true)
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <InspectJsonModal
        open={historyOpen}
        title={t('images.historyTitle')}
        jsonText={historyText}
        onClose={() => setHistoryOpen(false)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('images.title')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={pullTag}
            onChange={(e) => setPullTag(e.target.value)}
            placeholder={t('images.pullPlaceholder')}
            className="w-48 rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] dark:border-zinc-600 dark:bg-zinc-900"
          />
          <button
            type="button"
            disabled={busy || pulling}
            onClick={onPull}
            className="rounded-md bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {pulling ? t('images.pulling') : t('images.pull')}
          </button>
          <button
            type="button"
            disabled={!sel || busy}
            onClick={() => void onRemove()}
            className="rounded-md border border-rose-400 px-2 py-1 text-[11px] text-rose-800 dark:border-rose-800 dark:text-rose-200"
          >
            {t('images.remove')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPruneDangling()}
            className="rounded-md border border-amber-400 px-2 py-1 text-[11px] text-amber-950 dark:border-amber-800 dark:text-amber-100"
          >
            {t('images.pruneDangling')}
          </button>
          <button
            type="button"
            disabled={!sel || busy || !imageNameForApi}
            onClick={() => void onSaveTar()}
            className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-600"
          >
            {t('images.saveTar')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onLoadTar()}
            className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-600"
          >
            {t('images.loadTar')}
          </button>
          <button
            type="button"
            disabled={!sel || busy || !imageNameForApi}
            onClick={() => void onHistory()}
            className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-600"
          >
            {t('images.history')}
          </button>
        </div>
      </div>
      {sel && imageNameForApi ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200/70 bg-zinc-50/80 p-2 text-[11px] dark:border-white/[0.06] dark:bg-zinc-900/50">
          <span className="self-center text-zinc-500">{t('images.tagSource')}</span>
          <code className="max-w-[200px] truncate rounded bg-zinc-200/80 px-1 py-0.5 font-mono text-[10px] dark:bg-zinc-800">
            {imageNameForApi}
          </code>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500">{t('images.tagRepo')}</span>
            <input
              value={tagRepo}
              onChange={(e) => setTagRepo(e.target.value)}
              className="w-40 rounded border border-zinc-300 bg-white px-2 py-1 font-mono dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500">{t('images.tagLabel')}</span>
            <input
              value={tagTag}
              onChange={(e) => setTagTag(e.target.value)}
              className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 font-mono dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
          <button
            type="button"
            disabled={busy || tagging || !tagRepo.trim()}
            onClick={onTag}
            className="rounded-md border border-zinc-400 bg-white px-2 py-1 font-medium dark:border-zinc-500 dark:bg-zinc-800"
          >
            {tagging ? t('common.loading') : t('images.tagAction')}
          </button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200/80 dark:border-white/[0.06]">
        <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-zinc-100/95 text-zinc-600 backdrop-blur dark:bg-zinc-900/95 dark:text-zinc-400">
            <tr>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.tags')}
              </th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.id')}
              </th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.size')}
              </th>
            </tr>
          </thead>
          <tbody>
            {images.map((im) => {
              const active = im.Id === selectedImageRef
              const tags = im.RepoTags?.filter(Boolean).join(', ') || `<${shortId(im.Id)}>`
              return (
                <tr
                  key={im.Id}
                  onClick={() => setSelectedImageRef(im.Id)}
                  className={`cursor-pointer border-b border-zinc-100 hover:bg-sky-500/5 dark:border-zinc-800/80 dark:hover:bg-sky-500/10 ${
                    active ? 'bg-sky-500/10 dark:bg-sky-500/15' : ''
                  }`}
                >
                  <td className="px-2 py-1.5 text-zinc-900 dark:text-zinc-100">{tags}</td>
                  <td className="px-2 py-1.5 font-mono text-zinc-600 dark:text-zinc-400">{shortId(im.Id)}</td>
                  <td className="px-2 py-1.5">{formatBytes(im.Size)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
