import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const electronEntrypoint = path.resolve(projectRoot, 'node_modules/electron/cli.js')
const electronMain = path.resolve(projectRoot, 'desktop/electron/main.ts')
const distIndexHtml = path.resolve(projectRoot, 'dist/index.html')

if (!fs.existsSync(electronEntrypoint)) {
  throw new Error('缺少 electron 依赖，请先执行 npm install。')
}

if (!fs.existsSync(distIndexHtml)) {
  throw new Error('缺少 dist/index.html，请先执行 npm run desktop:build。')
}

const child = spawn(process.execPath, [electronEntrypoint, electronMain], {
  cwd: projectRoot,
  env: {
    ...process.env,
    JARVIS_DESKTOP_MODE: 'production',
  },
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
