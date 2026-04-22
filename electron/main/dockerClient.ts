import Docker from 'dockerode'

let docker: Docker | null = null

export function getDocker(): Docker {
  if (!docker) {
    docker = new Docker()
  }
  return docker
}

/** 丢弃内部客户端实例，下次 `getDocker()` 会新建（用于切换 DOCKER_HOST 等场景）。 */
export function resetDockerClient(): void {
  docker = null
}
