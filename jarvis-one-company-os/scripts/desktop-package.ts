import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const electronBuilderCli = path.resolve(projectRoot, 'node_modules', 'electron-builder', 'cli.js')

type Step = {
  command: string
  args: string[]
}

if (!fs.existsSync(electronBuilderCli)) {
  throw new Error('缺少 electron-builder 依赖。当前环境安装失败，请在网络可用时重新执行 npm install -D electron-builder。')
}

const buildSteps: Step[] = [
  { command: 'npm', args: ['run', 'build'] },
  { command: 'npx', args: ['tsc', '-p', 'tsconfig.electron.json'] },
]

for (const step of buildSteps) {
  const result = spawnSync(step.command, step.args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

const packageResult = spawnSync(process.execPath, [electronBuilderCli, '--win', 'nsis'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(packageResult.status ?? 0)
