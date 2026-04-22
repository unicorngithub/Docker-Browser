import { rmSync } from 'node:fs'

for (const d of ['dist-electron', 'dist']) {
  rmSync(d, { recursive: true, force: true })
}
