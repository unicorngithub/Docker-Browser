import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreateContainerModal } from '@/components/CreateContainerModal'
import { EditContainerConfigModal } from '@/components/EditContainerConfigModal'
import { EditContainerRuntimeModal } from '@/components/EditContainerRuntimeModal'
import { useAppDialog } from '@/dialog/AppDialogContext'
import { useDockerStore } from '@/stores/dockerStore'
import { unwrapIpc } from '@/lib/ipc'
import { localizeContainerState, localizeContainerStatus } from '@/lib/containerDisplayI18n'
import type { ContainerPortRow } from '@/lib/containerPortsDisplay'
import { formatContainerPortsSummary } from '@/lib/containerPortsDisplay'
import { groupContainersByComposeProject } from '@/lib/containerProjectGroup'
import { redactSensitiveJson } from '@shared/redactSensitiveJson'
import { InspectJsonModal } from '@/components/InspectJsonModal'

type Row = {
  Id: string
  Names?: string[]
  Image?: string
  State?: string
  Status?: string
  Ports?: ContainerPortRow[]
  Labels?: Record<string, string>
}

/** 展示用短 ID：去掉 `sha256:` 前缀后取前 12 位 */
function shortId(id: string): string {
  return id.replace(/^sha256:/i, '').slice(0, 12)
}

function displayName(c: Row): string {
  const n = c.Names?.[0]
  if (n) return n.replace(/^\//, '')
  return shortId(c.Id)
}

export function ContainersView() {
  const { t, i18n } = useTranslation()
  const { alert, confirm } = useAppDialog()
  const [showCreate, setShowCreate] = useState(false)
  const [execCmd, setExecCmd] = useState('ls -la')
  const [execOut, setExecOut] = useState('')
  const [execBusy, setExecBusy] = useState(false)
  /** 被折叠的项目 `projectKey`；不在集合内表示展开 */
  const [collapsedProjectKeys, setCollapsedProjectKeys] = useState<Set<string>>(() => new Set())
  const ctxMenuRef = useRef<HTMLDivElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; containerId: string } | null>(null)
  const [runtimeConfigContainerId, setRuntimeConfigContainerId] = useState<string | null>(null)
  const [recreateConfigContainerId, setRecreateConfigContainerId] = useState<string | null>(null)
  const [inspectOpen, setInspectOpen] = useState(false)
  const [inspectTitle, setInspectTitle] = useState('')
  const [inspectText, setInspectText] = useState('')
  const [commitForId, setCommitForId] = useState<string | null>(null)
  const [commitRepo, setCommitRepo] = useState('my/snapshot')
  const [commitTag, setCommitTag] = useState('dev')
  const containers = useDockerStore((s) => s.containers) as Row[]
  const busy = useDockerStore((s) => s.busy)
  const selectedContainerId = useDockerStore((s) => s.selectedContainerId)
  const setSelectedContainerId = useDockerStore((s) => s.setSelectedContainerId)
  const afterMutation = useDockerStore((s) => s.afterMutation)

  const sel = containers.find((c) => c.Id === selectedContainerId) ?? null

  const grouped = useMemo(
    () => groupContainersByComposeProject(containers, t('containers.projectUngrouped')),
    [containers, t, i18n.language],
  )

  const toggleProjectOpen = (projectKey: string) => {
    setCollapsedProjectKeys((prev) => {
      const next = new Set(prev)
      if (next.has(projectKey)) next.delete(projectKey)
      else next.add(projectKey)
      return next
    })
  }

  const isProjectOpen = (projectKey: string) => !collapsedProjectKeys.has(projectKey)

  useEffect(() => {
    if (!ctxMenu) return
    let attached = false
    const onPointer = (e: PointerEvent) => {
      if (ctxMenuRef.current?.contains(e.target as Node)) return
      setCtxMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null)
    }
    const raf = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', onPointer, true)
      attached = true
    })
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      if (attached) document.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [ctxMenu])

  const openLogsWindow = (containerId: string) => {
    void window.dockerDesktop.openContainerLogsWindow(containerId).then(async (res) => {
      if (!res.ok) await alert(res.error)
    })
  }

  const openInspectRedacted = async (id: string) => {
    const res = await window.dockerDesktop.inspectContainer(id)
    if (!res.ok) {
      await alert(res.error)
      return
    }
    setInspectTitle(t('containers.inspectRedacted'))
    setInspectText(JSON.stringify(redactSensitiveJson(res.data), null, 2))
    setInspectOpen(true)
  }

  const openStats = async (id: string) => {
    const res = await window.dockerDesktop.containerStatsOnce(id)
    if (!res.ok) {
      await alert(res.error)
      return
    }
    setInspectTitle(t('containers.statsTitle'))
    setInspectText(JSON.stringify(res.data, null, 2))
    setInspectOpen(true)
  }

  const exportTar = async (id: string) => {
    if (!(await confirm(t('containers.exportTarConfirm')))) return
    void run(async () => {
      const res = await window.dockerDesktop.exportContainerTar({ containerId: id })
      if (!res.ok) throw new Error(res.error)
      await alert(res.data.filePath)
    })
  }

  const submitCommit = () => {
    if (!commitForId) return
    const repo = commitRepo.trim()
    if (!repo) return
    void run(async () => {
      await unwrapIpc(
        window.dockerDesktop.commitContainer({
          containerId: commitForId,
          repo,
          tag: commitTag.trim() || 'latest',
        }),
      )
      setCommitForId(null)
    })
  }

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
    if (!(await confirm(t('containers.removeConfirm')))) return
    const running = (sel.State ?? '').toLowerCase() === 'running'
    void run(async () => {
      await unwrapIpc(
        window.dockerDesktop.removeContainer({
          id: sel.Id,
          force: running,
        }),
      )
      setSelectedContainerId(null)
    })
  }

  const onExec = async () => {
    if (!sel) return
    setExecBusy(true)
    setExecOut('')
    try {
      const res = await window.dockerDesktop.execOnce({
        containerId: sel.Id,
        command: execCmd.trim(),
      })
      if (!res.ok) throw new Error(res.error)
      const exit = res.data.exitCode
      setExecOut(
        (res.data.output || '') +
          (typeof exit === 'number' ? `\n\n[exit ${exit}]` : ''),
      )
    } catch (e) {
      setExecOut(e instanceof Error ? e.message : String(e))
    } finally {
      setExecBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <InspectJsonModal
        open={inspectOpen}
        title={inspectTitle}
        jsonText={inspectText}
        onClose={() => setInspectOpen(false)}
      />
      <CreateContainerModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => void afterMutation()}
      />
      <EditContainerRuntimeModal
        open={runtimeConfigContainerId !== null}
        containerId={runtimeConfigContainerId ?? ''}
        onClose={() => setRuntimeConfigContainerId(null)}
        onSaved={() => void afterMutation()}
      />
      <EditContainerConfigModal
        open={recreateConfigContainerId !== null}
        containerId={recreateConfigContainerId ?? ''}
        onClose={() => setRecreateConfigContainerId(null)}
        onRecreated={(newId) => {
          setSelectedContainerId(newId)
          void afterMutation()
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="text-sm font-semibold">{t('containers.title')}</h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowCreate(true)}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-base font-semibold leading-none text-white hover:bg-emerald-500 disabled:opacity-40"
            title={t('containers.createRun')}
            aria-label={t('containers.createRun')}
          >
            +
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!sel || busy}
            onClick={() => sel && void run(async () => unwrapIpc(window.dockerDesktop.startContainer(sel.Id)))}
            className="rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
          >
            {t('containers.start')}
          </button>
          <button
            type="button"
            disabled={!sel || busy}
            onClick={() => sel && void run(async () => unwrapIpc(window.dockerDesktop.stopContainer(sel.Id)))}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] dark:border-zinc-600 dark:bg-zinc-900"
          >
            {t('containers.stop')}
          </button>
          <button
            type="button"
            disabled={!sel || busy}
            onClick={() => sel && void run(async () => unwrapIpc(window.dockerDesktop.restartContainer(sel.Id)))}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] dark:border-zinc-600 dark:bg-zinc-900"
          >
            {t('containers.restart')}
          </button>
          <button
            type="button"
            disabled={!sel || busy}
            onClick={() => sel && void run(async () => unwrapIpc(window.dockerDesktop.killContainer(sel.Id)))}
            className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
          >
            {t('containers.kill')}
          </button>
          <button
            type="button"
            disabled={!sel || busy}
            onClick={() => sel && void run(async () => unwrapIpc(window.dockerDesktop.pauseContainer(sel.Id)))}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] dark:border-zinc-600 dark:bg-zinc-900"
          >
            {t('containers.pause')}
          </button>
          <button
            type="button"
            disabled={!sel || busy}
            onClick={() => sel && void run(async () => unwrapIpc(window.dockerDesktop.unpauseContainer(sel.Id)))}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] dark:border-zinc-600 dark:bg-zinc-900"
          >
            {t('containers.unpause')}
          </button>
          <button
            type="button"
            disabled={!sel || busy}
            onClick={() => void onRemove()}
            className="rounded-md border border-rose-400 px-2 py-1 text-[11px] text-rose-800 dark:border-rose-800 dark:text-rose-200"
          >
            {t('containers.remove')}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200/80 dark:border-white/[0.06]">
        <table
          className="w-full min-w-[820px] border-collapse text-left text-[11px]"
          role="treegrid"
          aria-label={t('containers.title')}
        >
          <thead className="sticky top-0 z-10 bg-zinc-100/95 text-zinc-600 backdrop-blur dark:bg-zinc-900/95 dark:text-zinc-400">
            <tr>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.name')}
              </th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.id')}
              </th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.image')}
              </th>
              <th
                className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800"
                title={t('containers.portsColumnHint')}
              >
                {t('containers.portsColumnTitle')}
              </th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.state')}
              </th>
              <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">
                {t('common.status')}
              </th>
            </tr>
          </thead>
          {grouped.map((group) => {
            const open = isProjectOpen(group.projectKey)
            const childrenId = `project-children-${group.projectKey}`
            return (
              <Fragment key={group.projectKey}>
                <tbody>
                  <tr className="border-b border-zinc-200 bg-zinc-200/90 dark:border-zinc-700 dark:bg-zinc-800/90">
                    <td colSpan={6} className="p-0">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] font-semibold tracking-tight text-zinc-800 hover:bg-zinc-300/60 dark:text-zinc-100 dark:hover:bg-zinc-700/80"
                        onClick={() => toggleProjectOpen(group.projectKey)}
                        aria-expanded={open}
                        aria-controls={childrenId}
                        id={`project-node-${group.projectKey}`}
                        title={
                          open
                            ? t('containers.treeCollapseHint', { name: group.projectLabel })
                            : t('containers.treeExpandHint', { name: group.projectLabel })
                        }
                      >
                        <span
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-400/60 bg-white/80 text-[10px] text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-300"
                          aria-hidden
                        >
                          {open ? '▼' : '▶'}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400">{t('containers.projectGroup')}</span>
                        <span className="font-mono text-zinc-900 dark:text-zinc-50">{group.projectLabel}</span>
                        <span className="font-normal text-zinc-500 dark:text-zinc-400">({group.items.length})</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
                <tbody id={childrenId} hidden={!open}>
                  {group.items.map((c) => {
                    const active = c.Id === selectedContainerId
                    const portsText = formatContainerPortsSummary(c.Ports)
                    return (
                      <tr
                        key={c.Id}
                        onClick={() => setSelectedContainerId(c.Id)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setSelectedContainerId(c.Id)
                          setCtxMenu({ x: e.clientX, y: e.clientY, containerId: c.Id })
                        }}
                        className={`cursor-pointer border-b border-zinc-100 hover:bg-sky-500/5 dark:border-zinc-800/80 dark:hover:bg-sky-500/10 ${
                          active ? 'bg-sky-500/10 dark:bg-sky-500/15' : ''
                        }`}
                        role="row"
                      >
                      <td className="select-text px-2 py-1.5 pl-4 font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-3 shrink-0 self-stretch border-l-2 border-sky-500/35 dark:border-sky-400/30"
                            aria-hidden
                          />
                          <span>{displayName(c)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex max-w-[200px] items-center gap-0.5">
                          <span
                            className="select-text font-mono text-[10px] text-zinc-600 dark:text-zinc-400"
                            title={c.Id}
                          >
                            {shortId(c.Id)}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                            title={t('containers.copyIdTitle')}
                            aria-label={t('containers.copyIdTitle')}
                            onClick={(e) => {
                              e.stopPropagation()
                              void (async () => {
                                try {
                                  await navigator.clipboard.writeText(c.Id)
                                } catch {
                                  await alert(t('containers.copyIdFailed'))
                                }
                              })()
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="max-w-[min(260px,32vw)] truncate px-2 py-1.5 text-zinc-700 select-text dark:text-zinc-300">
                        {c.Image ?? '—'}
                      </td>
                      <td
                        className="max-w-[min(240px,32vw)] whitespace-pre-line px-2 py-1.5 align-top font-mono text-[10px] leading-snug text-zinc-700 dark:text-zinc-300"
                        title={portsText || t('containers.portsNone')}
                      >
                        {portsText || '—'}
                      </td>
                      <td className="px-2 py-1.5" title={c.State ?? undefined}>
                        {localizeContainerState(c.State, t)}
                      </td>
                      <td
                        className="px-2 py-1.5 text-zinc-600 dark:text-zinc-400"
                        title={c.Status ?? undefined}
                      >
                        {localizeContainerStatus(c.Status, t, i18n.resolvedLanguage ?? i18n.language)}
                      </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Fragment>
            )
          })}
        </table>
      </div>
      {sel ? (
        <div
          className="shrink-0 rounded-lg border border-zinc-200/80 bg-white/60 p-3 dark:border-white/[0.06] dark:bg-zinc-900/40"
          onContextMenu={(e) => {
            e.preventDefault()
            setCtxMenu({ x: e.clientX, y: e.clientY, containerId: sel.Id })
          }}
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void openInspectRedacted(sel.Id)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-[10px] dark:border-zinc-600"
            >
              {t('containers.inspectRedacted')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void openStats(sel.Id)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-[10px] dark:border-zinc-600"
            >
              {t('containers.statsOnce')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void exportTar(sel.Id)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-[10px] dark:border-zinc-600"
            >
              {t('containers.exportTar')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setCommitForId(sel.Id)}
              className="rounded-md border border-emerald-400 px-2 py-1 text-[10px] text-emerald-900 dark:border-emerald-800 dark:text-emerald-100"
            >
              {t('containers.commitImage')}
            </button>
          </div>
          {commitForId === sel.Id ? (
            <div className="mb-3 rounded-md border border-amber-200/80 bg-amber-50/80 p-2 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="mb-2 text-[10px] font-semibold text-amber-950 dark:text-amber-100">
                {t('containers.commitImage')}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-0.5 text-[10px]">
                  <span className="text-zinc-600 dark:text-zinc-400">{t('containers.commitRepo')}</span>
                  <input
                    value={commitRepo}
                    onChange={(e) => setCommitRepo(e.target.value)}
                    className="w-44 rounded border border-zinc-300 bg-white px-2 py-1 font-mono dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px]">
                  <span className="text-zinc-600 dark:text-zinc-400">{t('containers.commitTag')}</span>
                  <input
                    value={commitTag}
                    onChange={(e) => setCommitTag(e.target.value)}
                    className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 font-mono dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !commitRepo.trim()}
                  onClick={() => void submitCommit()}
                  className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-40"
                >
                  {t('common.confirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setCommitForId(null)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-[10px] dark:border-zinc-600"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : null}
          <h3 className="mb-1 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
            {t('containers.execTitle')}
          </h3>
          <p className="mb-2 text-[10px] text-zinc-500">{t('containers.execHint')}</p>
          <div className="flex flex-wrap items-end gap-2">
            <input
              value={execCmd}
              onChange={(e) => setExecCmd(e.target.value)}
              className="min-w-[200px] flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-[11px] dark:border-zinc-600 dark:bg-zinc-950"
              placeholder="ls -la"
            />
            <button
              type="button"
              disabled={execBusy || !execCmd.trim()}
              onClick={() => void onExec()}
              className="rounded-md bg-sky-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
            >
              {execBusy ? t('common.loading') : t('containers.execRun')}
            </button>
          </div>
          {execOut ? (
            <pre className="mt-2 max-h-40 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] dark:border-zinc-700 dark:bg-black/30">
              {execOut}
            </pre>
          ) : null}
        </div>
      ) : null}
      {ctxMenu ? (
        <div
          ref={ctxMenuRef}
          role="menu"
          className="fixed z-[100] min-w-[11rem] rounded-md border border-zinc-200 bg-white py-1 text-[11px] shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              void openInspectRedacted(ctxMenu.containerId)
              setCtxMenu(null)
            }}
          >
            {t('containers.inspectRedacted')}
          </button>
          <button
            type="button"
            role="menuitem"
            title={t('containers.contextConfigInPlaceHint')}
            className="block w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setRuntimeConfigContainerId(ctxMenu.containerId)
              setCtxMenu(null)
            }}
          >
            {t('containers.contextConfigInPlace')}
          </button>
          <button
            type="button"
            role="menuitem"
            title={t('containers.contextConfigRecreateHint')}
            className="block w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setRecreateConfigContainerId(ctxMenu.containerId)
              setCtxMenu(null)
            }}
          >
            {t('containers.contextConfigRecreate')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              openLogsWindow(ctxMenu.containerId)
              setCtxMenu(null)
            }}
          >
            {t('logs.title')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
