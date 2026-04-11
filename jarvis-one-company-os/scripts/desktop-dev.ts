import fs from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import process from 'node:process'
import { spawn, execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const electronMainJs = path.resolve(projectRoot, 'dist-electron/main.js')

function getElectronBinary(): string {
  const esmRequire = createRequire(import.meta.url)
  const electronPath: string = esmRequire('electron') as unknown as string
  return electronPath
}
const devServerUrl = process.env.JARVIS_DESKTOP_URL ?? 'http://localhost:5173'

type ProcEntry = { name: string; child: ReturnType<typeof spawn> }
const processes: ProcEntry[] = []
let isShuttingDown = false

function log(msg: string) {
  console.log(`[desktop] ${msg}`)
}

function startProcess(name: string, command: string, args: string[], extraEnv: Record<string, string> = {}, useShell = true) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: useShell && process.platform === 'win32',
  })
  processes.push({ name, child })

  child.on('exit', (code) => {
    if (isShuttingDown) return
    isShuttingDown = true
    console.error(`[desktop] ${name} exited (code ${code ?? 0}), stopping...`)
    shutdown(code ?? 1)
  })

  return child
}

function shutdown(exitCode = 0) {
  isShuttingDown = true
  for (const { child } of processes) {
    if (!child.killed) child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(exitCode), 300)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

function waitForUrl(url: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    function check() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`等待 ${url} 超时（${timeoutMs / 1000}s）`))
        return
      }
      http.get(url, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode < 500) {
          resolve()
        } else {
          setTimeout(check, 500)
        }
      }).on('error', () => {
        setTimeout(check, 500)
      })
    }
    check()
  })
}

function buildElectronIfNeeded() {
  if (!fs.existsSync(electronMainJs)) {
    log('编译 Electron 主进程...')
    execSync('npx tsc -p tsconfig.electron.json', { cwd: projectRoot, stdio: 'inherit' })
  }

  const srcMtime = fs.statSync(path.resolve(projectRoot, 'desktop/electron/main.ts')).mtimeMs
  const outMtime = fs.statSync(electronMainJs).mtimeMs
  if (srcMtime > outMtime) {
    log('Electron 源码有更新，重新编译...')
    execSync('npx tsc -p tsconfig.electron.json', { cwd: projectRoot, stdio: 'inherit' })
  }
}

function assertDependencies() {
  const electronBin = getElectronBinary()
  if (!fs.existsSync(electronBin)) {
    throw new Error('缺少 electron 二进制，请执行: npm install electron')
  }
}

async function main() {
  assertDependencies()
  buildElectronIfNeeded()

  log('启动后端 API + 前端界面...')
  startProcess('dev-stack', 'npm', ['run', 'dev:full'])

  log(`等待前端就绪: ${devServerUrl}`)
  await waitForUrl(devServerUrl, 45_000)
  log('前端已就绪，启动 Electron 桌面窗口...')

  const electronBin = getElectronBinary()
  log(`Electron 路径: ${electronBin}`)
  startProcess('electron', electronBin, [electronMainJs], {
    JARVIS_DESKTOP_URL: devServerUrl,
  }, false)
}

main().catch((err) => {
  console.error('[desktop] 启动失败:', err.message ?? err)
  shutdown(1)
})
