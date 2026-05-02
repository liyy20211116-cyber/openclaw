import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { spawn, ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const { app, BrowserWindow, dialog, screen } = electron
type ElectronBrowserWindow = InstanceType<typeof BrowserWindow>

let startScheduler: ((root: string, log?: (msg: string) => void) => void) | null = null
let stopScheduler: (() => void) | null = null

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu-compositing')

const DEFAULT_DEV_SERVER_URL = 'http://localhost:5173'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appRoot = app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '..')
const unpackedRoot = app.isPackaged ? appRoot.replace('app.asar', 'app.asar.unpacked') : appRoot
const preloadEntry = path.resolve(__dirname, 'preload.js')
const fallbackHtml = path.resolve(__dirname, 'fallback.html')
const distIndexHtml = path.resolve(appRoot, 'dist', 'index.html')
const desktopMode = (process.env.JARVIS_DESKTOP_MODE === 'production' || app.isPackaged) ? 'production' : 'development'
const devServerUrl = process.env.JARVIS_DESKTOP_URL ?? DEFAULT_DEV_SERVER_URL
const stateFile = path.join(app.getPath('userData'), 'window-state.json')
const BACKEND_PORT = Number(process.env.WRITEBACK_API_PORT ?? 18782)
const CLIPROXY_PORT = Number(process.env.CLIPROXY_PORT ?? 18800)
let backendProcess: ChildProcess | null = null
let cliproxyProcess: ChildProcess | null = null
let openclawProcess: ChildProcess | null = null
const OPENCLAW_PORT = Number(process.env.OPENCLAW_PORT ?? 18789)

function getCompanyDataDir(): string {
  if (!app.isPackaged) {
    return path.resolve(appRoot, '..')
  }
  return path.join(app.getPath('userData'), 'company-data')
}

function getBackupDir(): string {
  return path.join(app.getPath('userData'), 'backups')
}

function performDataBackup(companyDataDir: string): void {
  const backupDir = getBackupDir()
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

  const now = new Date()
  const tag = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupPath = path.join(backupDir, `backup-${tag}`)
  fs.mkdirSync(backupPath, { recursive: true })

  const dbSource = path.join(app.isPackaged ? path.resolve(app.getPath('userData')) : path.resolve(appRoot), 'dev.db')
  if (fs.existsSync(dbSource)) {
    try {
      fs.copyFileSync(dbSource, path.join(backupPath, 'dev.db'))
      debugLog(`Backup: SQLite database copied to ${backupPath}`)
    } catch (err) {
      debugLog(`Backup: Failed to copy database: ${err}`)
    }
  }

  const configDir = path.join(companyDataDir, 'config')
  if (fs.existsSync(configDir)) {
    try {
      copyDirRecursive(configDir, path.join(backupPath, 'config'))
      debugLog('Backup: config directory copied')
    } catch (err) {
      debugLog(`Backup: Failed to copy config: ${err}`)
    }
  }

  const agentsMemoryFiles: string[] = []
  const agentsDir = path.join(companyDataDir, 'openclaw_agents')
  if (fs.existsSync(agentsDir)) {
    const agentsBackup = path.join(backupPath, 'openclaw_agents')
    for (const agent of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!agent.isDirectory()) continue
      const memDir = path.join(agentsDir, agent.name, 'memory')
      if (fs.existsSync(memDir)) {
        const dst = path.join(agentsBackup, agent.name, 'memory')
        copyDirRecursive(memDir, dst)
        agentsMemoryFiles.push(agent.name)
      }
    }
    if (agentsMemoryFiles.length > 0) {
      debugLog(`Backup: Agent memories copied for ${agentsMemoryFiles.join(', ')}`)
    }
  }

  const manifest = {
    version: '1.0',
    timestamp: now.toISOString(),
    includes: ['database', 'config', 'agent_memories'],
    agents_backed_up: agentsMemoryFiles,
  }
  fs.writeFileSync(path.join(backupPath, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')

  cleanOldBackups(backupDir, 7)
  debugLog(`Backup completed: ${backupPath}`)
}

function cleanOldBackups(backupDir: string, keepDays: number): void {
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000
  try {
    for (const entry of fs.readdirSync(backupDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('backup-')) continue
      const entryPath = path.join(backupDir, entry.name)
      const stat = fs.statSync(entryPath)
      if (stat.mtimeMs < cutoff) {
        fs.rmSync(entryPath, { recursive: true, force: true })
        debugLog(`Backup: Cleaned old backup ${entry.name}`)
      }
    }
  } catch { /* skip */ }
}

function copyDirRecursive(src: string, dst: string): void {
  if (!fs.existsSync(src)) return
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const dstPath = path.join(dst, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath)
    } else {
      fs.copyFileSync(srcPath, dstPath)
    }
  }
}

function syncAgentSkills(bundledDir: string, targetDir: string): void {
  if (!fs.existsSync(bundledDir)) return
  for (const agent of fs.readdirSync(bundledDir, { withFileTypes: true })) {
    if (!agent.isDirectory()) continue
    const srcAgent = path.join(bundledDir, agent.name)
    const dstAgent = path.join(targetDir, agent.name)
    if (!fs.existsSync(dstAgent)) { copyDirRecursive(srcAgent, dstAgent); continue }
    for (const file of fs.readdirSync(srcAgent, { withFileTypes: true })) {
      if (file.isDirectory()) continue
      if (file.name === 'skills.json' || file.name.startsWith('skill_')) {
        const src = path.join(srcAgent, file.name)
        const dst = path.join(dstAgent, file.name)
        try {
          const srcStat = fs.statSync(src)
          const dstStat = fs.existsSync(dst) ? fs.statSync(dst) : null
          if (!dstStat || srcStat.mtimeMs > dstStat.mtimeMs || srcStat.size !== dstStat.size) {
            fs.copyFileSync(src, dst)
            debugLog(`Synced skill file: ${agent.name}/${file.name}`)
          }
        } catch { /* skip on error */ }
      }
    }
  }
}

function initCompanyData(): string {
  const dataDir = getCompanyDataDir()
  if (!app.isPackaged) return dataDir

  const resourcesDir = path.resolve(process.resourcesPath)
  const bundledAgents = path.join(resourcesDir, 'openclaw_agents')
  const bundledConfig = path.join(resourcesDir, 'config')
  const targetAgents = path.join(dataDir, 'openclaw_agents')
  const targetConfig = path.join(dataDir, 'config')
  const marker = path.join(dataDir, '.initialized')

  if (!fs.existsSync(marker)) {
    debugLog(`Initializing company data: ${dataDir}`)
    if (fs.existsSync(bundledAgents)) copyDirRecursive(bundledAgents, targetAgents)
    if (fs.existsSync(bundledConfig)) copyDirRecursive(bundledConfig, targetConfig)
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(marker, new Date().toISOString(), 'utf-8')
    debugLog('Company data initialized')
  } else {
    syncAgentSkills(bundledAgents, targetAgents)
  }

  return dataDir
}

type WindowState = {
  width: number
  height: number
  x?: number
  y?: number
}

function getDefaultWindowState(): WindowState {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  return {
    width: Math.min(Math.max(1280, Math.floor(width * 0.86)), width),
    height: Math.min(Math.max(820, Math.floor(height * 0.86)), height),
  }
}

function readWindowState(): WindowState {
  const fallback = getDefaultWindowState()
  if (!fs.existsSync(stateFile)) {
    return fallback
  }

  try {
    const raw = fs.readFileSync(stateFile, 'utf8')
    const parsed = JSON.parse(raw) as Partial<WindowState>
    if (typeof parsed.width !== 'number' || typeof parsed.height !== 'number') {
      return fallback
    }

    return {
      width: parsed.width,
      height: parsed.height,
      x: typeof parsed.x === 'number' ? parsed.x : undefined,
      y: typeof parsed.y === 'number' ? parsed.y : undefined,
    }
  } catch {
    return fallback
  }
}

function writeWindowState(window: ElectronBrowserWindow) {
  if (window.isMinimized() || window.isMaximized()) {
    return
  }

  const bounds = window.getBounds()
  fs.writeFileSync(stateFile, JSON.stringify(bounds, null, 2), 'utf8')
}

let prodServerPort = 0

function startProductionServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const distDir = path.resolve(appRoot, 'dist')
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
      '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
    }

    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url ?? '/', `http://127.0.0.1`)

      if (parsedUrl.pathname.startsWith('/api/') || parsedUrl.pathname === '/health') {
        const proxyReq = http.request({
          hostname: '127.0.0.1',
          port: BACKEND_PORT,
          path: parsedUrl.pathname + parsedUrl.search,
          method: req.method,
          headers: { ...req.headers, host: `127.0.0.1:${BACKEND_PORT}` },
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
          proxyRes.pipe(res, { end: true })
        })
        proxyReq.on('error', () => { res.writeHead(502); res.end('Backend unavailable') })
        req.pipe(proxyReq, { end: true })
        return
      }

      let filePath = path.join(distDir, parsedUrl.pathname)
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html')
      }
      const ext = path.extname(filePath)
      const contentType = mimeTypes[ext] || 'application/octet-stream'
      try {
        const content = fs.readFileSync(filePath)
        res.writeHead(200, { 'Content-Type': contentType })
        res.end(content)
      } catch {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    const listenHost = process.env.JARVIS_LAN_ACCESS === '1' ? '0.0.0.0' : '127.0.0.1'
    server.listen(0, listenHost, () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve(port)
    })
    server.on('error', reject)
  })
}

async function loadRenderer(window: ElectronBrowserWindow) {
  if (desktopMode === 'production') {
    if (!fs.existsSync(distIndexHtml)) {
      dialog.showErrorBox('桌面端资源缺失', `未找到构建产物：${distIndexHtml}`)
      return
    }

    try {
      prodServerPort = await startProductionServer()
      debugLog(`Production static server on port ${prodServerPort}`)
      await window.loadURL(`http://127.0.0.1:${prodServerPort}/`)
    } catch (err) {
      debugLog(`Production server failed: ${err}`)
      await window.loadFile(distIndexHtml)
    }
    return
  }

  try {
    await window.loadURL(devServerUrl)
  } catch (error) {
    await window.loadFile(fallbackHtml, {
      query: {
        mode: desktopMode,
        target: devServerUrl,
        hint: error instanceof Error ? error.message : '未知错误',
      },
    })
    dialog.showErrorBox('桌面端加载失败', `无法连接到本地页面：${devServerUrl}\n请确认 npm run desktop:start 已完成启动。`)
  }
}

function createWindow() {
  const savedState = readWindowState()
  const window = new BrowserWindow({
    ...savedState,
    minWidth: 1200,
    minHeight: 760,
    title: 'Jarvis One Company OS',
    autoHideMenuBar: true,
    backgroundColor: '#020617',
    show: false,
    webPreferences: {
      preload: preloadEntry,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })

  window.once('ready-to-show', () => {
    debugLog('Event: ready-to-show')
    window.show()
  })

  window.on('close', () => {
    debugLog('Event: close')
    writeWindowState(window)
  })

  window.webContents.on('did-finish-load', () => {
    debugLog(`Event: did-finish-load, URL=${window.webContents.getURL()}`)
  })

  window.webContents.on('render-process-gone', (_event, details) => {
    debugLog(`Event: render-process-gone, reason=${details.reason}, exitCode=${details.exitCode}`)
    setTimeout(() => {
      if (!window.isDestroyed()) {
        debugLog('Attempting renderer reload after crash...')
        void loadRenderer(window)
      }
    }, 1500)
  })

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    debugLog(`Event: did-fail-load, code=${errorCode}, desc=${errorDescription}, url=${validatedURL}`)
    if (errorCode !== -3) {
      setTimeout(() => {
        if (!window.isDestroyed()) {
          debugLog('Retrying loadRenderer after did-fail-load...')
          void loadRenderer(window)
        }
      }, 2000)
    }
  })

  window.webContents.on('unresponsive', () => {
    debugLog('Event: unresponsive — renderer hung')
  })

  window.webContents.on('responsive', () => {
    debugLog('Event: responsive — renderer recovered')
  })

  window.on('focus', () => {
    if (!window.isDestroyed()) {
      window.webContents.invalidate()
    }
  })

  window.on('show', () => {
    if (!window.isDestroyed()) {
      window.webContents.invalidate()
    }
  })

  window.on('restore', () => {
    if (!window.isDestroyed()) {
      window.webContents.invalidate()
    }
  })

  window.on('resized', () => {
    writeWindowState(window)
  })

  window.on('moved', () => {
    writeWindowState(window)
  })

  if (desktopMode === 'development') {
    window.webContents.on('did-fail-load', async (_event, errorCode, errorDescription) => {
      await window.loadFile(fallbackHtml, {
        query: {
          mode: desktopMode,
          target: devServerUrl,
          hint: `错误代码 ${errorCode}：${errorDescription}`,
        },
      })
      dialog.showErrorBox('桌面端加载失败', `无法连接到本地页面：${devServerUrl}\n错误代码：${errorCode}\n原因：${errorDescription}`)
    })
  }

  void loadRenderer(window)
  return window
}

function checkBackendHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/health`, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => { req.destroy(); resolve(false) })
  })
}

async function waitForBackend(timeoutMs = 60_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await checkBackendHealth()) return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

function startBackendIfNeeded(companyDataDir?: string): void {
  if (desktopMode !== 'production') return

  const backendScript = path.resolve(unpackedRoot, 'dist-backend', 'writeback-api.js')
  if (!fs.existsSync(backendScript)) return

  const logFile = path.join(app.getPath('userData'), 'backend.log')
  const fd = fs.openSync(logFile, 'a')

  backendProcess = spawn(process.execPath, [backendScript], {
    cwd: unpackedRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      ...(companyDataDir ? { JARVIS_COMPANY_DATA_DIR: companyDataDir } : {}),
    },
    stdio: ['ignore', fd, fd],
    detached: false,
    windowsHide: true,
  })

  backendProcess.on('exit', (code) => {
    try { fs.closeSync(fd) } catch { /* ignore */ }
    if (code !== 0 && code !== null) {
      debugLog(`Backend exited with code ${code}`)
    }
    backendProcess = null
  })
}

function stopBackend(): void {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGTERM')
    backendProcess = null
  }
}

function checkPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/v1/models`, (res) => {
      res.resume()
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => { req.destroy(); resolve(false) })
  })
}

function startCliProxyIfNeeded(): void {
  if (desktopMode !== 'production') return

  const cliproxyBin = path.resolve(process.resourcesPath, 'cliproxyapi', 'cli-proxy-api.exe')
  const cliproxyConfig = path.resolve(process.resourcesPath, 'cliproxyapi', 'config.yaml')

  if (!fs.existsSync(cliproxyBin)) {
    debugLog(`CLIProxyAPI binary not found: ${cliproxyBin}`)
    return
  }
  if (!fs.existsSync(cliproxyConfig)) {
    debugLog(`CLIProxyAPI config not found: ${cliproxyConfig}`)
    return
  }

  const logFile = path.join(app.getPath('userData'), 'cliproxy.log')
  const fd = fs.openSync(logFile, 'a')

  cliproxyProcess = spawn(cliproxyBin, ['-config', cliproxyConfig], {
    cwd: path.dirname(cliproxyBin),
    stdio: ['ignore', fd, fd],
    detached: false,
    windowsHide: true,
  })

  cliproxyProcess.on('exit', (code) => {
    try { fs.closeSync(fd) } catch { /* ignore */ }
    debugLog(`CLIProxyAPI exited with code ${code}`)
    cliproxyProcess = null
  })

  debugLog(`CLIProxyAPI started (PID: ${cliproxyProcess.pid})`)
}

function stopCliProxy(): void {
  if (cliproxyProcess && !cliproxyProcess.killed) {
    cliproxyProcess.kill('SIGTERM')
    cliproxyProcess = null
  }
}

function findOpenClawCmd(): string | null {
  const npmGlobal = path.join(process.env.APPDATA ?? '', 'npm')
  const candidates = [
    path.join(npmGlobal, 'openclaw.cmd'),
    path.join(npmGlobal, 'openclaw'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}

function startOpenClawGateway(): void {
  const openclawCmd = findOpenClawCmd()
  if (!openclawCmd) {
    debugLog('OpenClaw command not found, skipping gateway start')
    return
  }

  const logFile = path.join(app.getPath('userData'), 'openclaw-gateway.log')
  const fd = fs.openSync(logFile, 'a')

  openclawProcess = spawn(openclawCmd, ['gateway', '--port', String(OPENCLAW_PORT), '--force', '--verbose'], {
    cwd: path.dirname(openclawCmd),
    stdio: ['ignore', fd, fd],
    detached: false,
    windowsHide: true,
    shell: true,
  })

  openclawProcess.on('exit', (code) => {
    try { fs.closeSync(fd) } catch { /* ignore */ }
    debugLog(`OpenClaw Gateway exited with code ${code}`)
    openclawProcess = null
  })

  debugLog(`OpenClaw Gateway started (PID: ${openclawProcess.pid}, port: ${OPENCLAW_PORT})`)
}

function stopOpenClaw(): void {
  if (openclawProcess && !openclawProcess.killed) {
    openclawProcess.kill('SIGTERM')
    openclawProcess = null
  }
}

const debugLogFile = path.join(app.getPath('userData'), 'main-debug.log')
function debugLog(msg: string): void {
  try { fs.appendFileSync(debugLogFile, `[${new Date().toISOString()}] ${msg}\n`) } catch { /* ignore */ }
}

app.whenReady().then(async () => {
  debugLog(`App ready. isPackaged=${app.isPackaged}, mode=${desktopMode}`)
  debugLog(`appRoot=${appRoot}, unpackedRoot=${unpackedRoot}`)
  debugLog(`distIndexHtml=${distIndexHtml}, exists=${fs.existsSync(distIndexHtml)}`)

  let companyDataDir = ''
  try {
    companyDataDir = initCompanyData()
    debugLog(`Company data dir: ${companyDataDir}`)
  } catch (err) {
    debugLog(`Company data init ERROR: ${err}`)
  }

  try {
    const cliproxyAlreadyRunning = await checkPortInUse(CLIPROXY_PORT)
    if (cliproxyAlreadyRunning) {
      debugLog(`CLIProxyAPI already running on port ${CLIPROXY_PORT}`)
    } else {
      startCliProxyIfNeeded()
    }
  } catch (err) {
    debugLog(`CLIProxyAPI start ERROR: ${err}`)
  }

  try {
    startBackendIfNeeded(companyDataDir)
    debugLog('Backend start done')
  } catch (err) {
    debugLog(`Backend start ERROR: ${err}`)
  }

  try {
    const openclawAlreadyRunning = await checkPortInUse(OPENCLAW_PORT)
    if (openclawAlreadyRunning) {
      debugLog(`OpenClaw Gateway already running on port ${OPENCLAW_PORT}`)
    } else {
      startOpenClawGateway()
    }
  } catch (err) {
    debugLog(`OpenClaw Gateway start ERROR: ${err}`)
  }

  if (desktopMode === 'production') {
    debugLog(`Checking backend health on port ${BACKEND_PORT}...`)
    const ready = await waitForBackend()
    debugLog(`Backend ready: ${ready}`)
    if (!ready) {
      const isExternalBackend = await checkBackendHealth()
      if (!isExternalBackend) {
        dialog.showErrorBox('后端服务未就绪', `无法连接到后端 API (port ${BACKEND_PORT})。\n请确认服务已启动。`)
      }
    }
  }

  try {
    if (companyDataDir) {
      performDataBackup(companyDataDir)
      debugLog('Startup backup completed')
    }
  } catch (err) {
    debugLog(`Startup backup ERROR: ${err}`)
  }

  try {
    const schedulerModule = await import('./schedulerService.js')
    startScheduler = schedulerModule.startScheduler
    stopScheduler = schedulerModule.stopScheduler
    const schedulerRoot = app.isPackaged ? companyDataDir : path.resolve(appRoot, '..')
    startScheduler(schedulerRoot, debugLog)
    debugLog('Scheduler started OK')
  } catch (err) {
    debugLog(`Scheduler start ERROR: ${err}`)
  }

  debugLog('Creating window...')
  createWindow()
  debugLog('Window created OK')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}).catch((err) => {
  debugLog(`FATAL: ${err}`)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (stopScheduler) stopScheduler()
  stopBackend()
  stopCliProxy()
  stopOpenClaw()
})

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})
