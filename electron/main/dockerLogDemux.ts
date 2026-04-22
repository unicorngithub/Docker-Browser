import type { Readable } from 'node:stream'

/**
 * Docker Engine 多路复用日志流（非 TTY）：8 字节头 + payload。
 * @see https://docs.docker.com/engine/api/v1.41/#tag/Container/operation/ContainerAttach
 */
export function demuxDockerLogStream(
  stream: Readable,
  onPayload: (streamType: number, payload: Buffer) => void,
): () => void {
  let buf = Buffer.alloc(0)

  const onData = (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk])
    while (buf.length >= 8) {
      const streamType = buf.readUInt8(0)
      const size = buf.readUInt32BE(4)
      if (buf.length < 8 + size) break
      const payload = buf.subarray(8, 8 + size)
      buf = buf.subarray(8 + size)
      onPayload(streamType, payload)
    }
  }

  stream.on('data', onData)
  return () => {
    stream.off('data', onData)
  }
}
