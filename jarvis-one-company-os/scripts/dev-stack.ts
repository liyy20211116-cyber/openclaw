import process from 'node:process'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

type ProcEntry = {
  name: string
  child: ReturnType<typeof spawn>
}

const processes: ProcEntry[] = []
let isShuttingDown = false

function startProcess(name: string, command: string, args: string[], extraEnv: Record<string, string> = {}) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  processes.push({ name, child })

  child.on('exit', (code) => {
    if (isShuttingDown) {
      return
    }

    isShuttingDown = true
    const exitCode = code ?? 0
    console.error(`[dev-stack] ${name} exited with code ${exitCode}, stopping the rest...`)
    shutdown(exitCode)
  })
}

function shutdown(exitCode = 0) {
  isShuttingDown = true
  for (const { child } of processes) {
    if (!child.killed) {
      child.kill('SIGTERM')
    }
  }

  setTimeout(() => process.exit(exitCode), 150)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('[dev-stack] starting writeback-api + vite ui')
console.log('[dev-stack] writeback api: http://127.0.0.1:18782')
console.log('[dev-stack] vite ui will print its local url below')
console.log('[dev-stack] desktop guide: npm run desktop:guide')
console.log('[dev-stack] desktop start: npm run desktop:start')
console.log('[dev-stack] windows entry: Start_Jarvis_One_Company_OS.bat')

startProcess('writeback-api', 'npm', ['run', 'db:writeback-api'])
startProcess('vite', 'npm', ['run', 'dev:ui'])
