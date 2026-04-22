import Docker from 'dockerode'

let docker: Docker | null = null

export function getDocker(): Docker {
  if (!docker) {
    docker = new Docker()
  }
  return docker
}
