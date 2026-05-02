import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const esmRequire = createRequire(import.meta.url)
const projectRoot = path.resolve(__dirname, '..')
const electronBinary = esmRequire('electron') as string
const electronMain = path.resolve(projectRoot, 'dist-electron/main.js')
const distIndexHtml = path.resolve(projectRoot, 'dist/index.html')

if (!fs.existsSync(electronMain)) {
  throw new Error('Missing dist-electron/main.js. Run npm run desktop:build first.')
}

if (!fs.existsSync(electronBinary)) {
  throw new Error('缺少 electron 依赖，请先执行 npm install。')
}

if (!fs.existsSync(distIndexHtml)) {
  throw new Error('缺少 dist/index.html，请先执行 npm run desktop:build。')
}

const childEnv: NodeJS.ProcessEnv = {
  ...process.env,
  JARVIS_DESKTOP_MODE: 'production',
}
delete childEnv.ELECTRON_RUN_AS_NODE

const child = spawn(electronBinary, [electronMain], {
  cwd: projectRoot,
  env: childEnv,
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
