import type { ContainerCreateOptions, ContainerInspectInfo, HostConfig } from 'dockerode'
import { normalizeRestartPolicyName, restartPolicyToDocker } from '../../shared/restartPolicy'
import { parseEnvLines, parsePortPublish } from './dockerCreateHelpers'

export function buildRecreateCreateOptions(
  ins: ContainerInspectInfo,
  input: {
    image: string
    name?: string
    envText: string
    publishText: string
    cmdText?: string
    autoRemove: boolean
    restartPolicy: string
  },
): { createOpts: ContainerCreateOptions; name?: string } {
  const image = input.image.trim()
  const env = parseEnvLines(input.envText)
  const ports = input.publishText.trim() ? parsePortPublish(input.publishText) : null
  const cmdRaw = typeof input.cmdText === 'string' ? input.cmdText.trim() : ''
  const Cmd = cmdRaw ? cmdRaw.split(/\s+/).filter(Boolean) : undefined

  const oldHc: HostConfig = ins.HostConfig
    ? (JSON.parse(JSON.stringify(ins.HostConfig)) as HostConfig)
    : ({} as HostConfig)
  delete (oldHc as { PortBindings?: unknown }).PortBindings
  if (input.autoRemove === true) oldHc.AutoRemove = true
  else delete oldHc.AutoRemove

  const rp = normalizeRestartPolicyName(input.restartPolicy)
  oldHc.RestartPolicy = input.autoRemove === true ? restartPolicyToDocker('no') : restartPolicyToDocker(rp)

  if (ports) {
    oldHc.PortBindings = ports.HostConfig.PortBindings
  } else {
    oldHc.PortBindings = {}
  }

  const createOpts: ContainerCreateOptions = {
    Image: image,
    Env: env.length ? env : undefined,
    Cmd: Cmd && Cmd.length ? Cmd : undefined,
    Labels: ins.Config.Labels,
    WorkingDir: ins.Config.WorkingDir || undefined,
    User: ins.Config.User || undefined,
    Hostname: ins.Config.Hostname || undefined,
    Domainname: ins.Config.Domainname || undefined,
    Tty: ins.Config.Tty,
    OpenStdin: ins.Config.OpenStdin,
    AttachStdin: ins.Config.AttachStdin,
    AttachStdout: ins.Config.AttachStdout,
    AttachStderr: ins.Config.AttachStderr,
    StdinOnce: ins.Config.StdinOnce,
    Entrypoint: ins.Config.Entrypoint,
    Healthcheck: ins.Config.Healthcheck,
    HostConfig: oldHc,
  }

  if (ports) {
    createOpts.ExposedPorts = { ...(ins.Config.ExposedPorts ?? {}), ...ports.ExposedPorts }
  } else if (ins.Config.ExposedPorts && Object.keys(ins.Config.ExposedPorts).length > 0) {
    createOpts.ExposedPorts = ins.Config.ExposedPorts
  }

  const nameNorm = input.name?.trim().replace(/^\/+/, '').toLowerCase()
  const fallbackName = ins.Name.replace(/^\/+/, '').toLowerCase()
  const name = nameNorm || fallbackName || undefined

  return { createOpts, name }
}
