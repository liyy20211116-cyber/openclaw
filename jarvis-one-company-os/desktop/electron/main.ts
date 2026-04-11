import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, screen } from 'electron'

const DEFAULT_DEV_SERVER_URL = 'http://localhost:5173'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')
const preloadEntry = path.resolve(__dirname, 'preload.js')
const fallbackHtml = path.resolve(__dirname, 'fallback.html')
const distIndexHtml = path.resolve(projectRoot, 'dist', 'index.html')
const desktopMode = process.env.JARVIS_DESKTOP_MODE === 'production' ? 'production' : 'development'
const devServerUrl = process.env.JARVIS_DESKTOP_URL ?? DEFAULT_DEV_SERVER_URL
const stateFile = path.join(app.getPath('userData'), 'window-state.json')

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

function writeWindowState(window: BrowserWindow) {
  if (window.isMinimized() || window.isMaximized()) {
    return
  }

  const bounds = window.getBounds()
  fs.writeFileSync(stateFile, JSON.stringify(bounds, null, 2), 'utf8')
}

async function loadRenderer(window: BrowserWindow) {
  if (desktopMode === 'production') {
    if (!fs.existsSync(distIndexHtml)) {
      await window.loadFile(fallbackHtml, {
        query: {
          mode: desktopMode,
          target: distIndexHtml,
          hint: '缺少 dist/index.html，请先执行 npm run desktop:build。',
        },
      })
      dialog.showErrorBox('桌面端资源缺失', `未找到构建产物：${distIndexHtml}\n请先执行 npm run desktop:build。`)
      return
    }

    await window.loadFile(distIndexHtml)
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
    },
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  window.on('close', () => {
    writeWindowState(window)
  })

  window.on('resized', () => {
    writeWindowState(window)
  })

  window.on('moved', () => {
    writeWindowState(window)
  })

  window.webContents.on('did-fail-load', async (_event, errorCode, errorDescription) => {
    if (desktopMode === 'production') {
      return
    }

    await window.loadFile(fallbackHtml, {
      query: {
        mode: desktopMode,
        target: devServerUrl,
        hint: `错误代码 ${errorCode}：${errorDescription}`,
      },
    })
    dialog.showErrorBox('桌面端加载失败', `无法连接到本地页面：${devServerUrl}\n错误代码：${errorCode}\n原因：${errorDescription}`)
  })

  void loadRenderer(window)
  return window
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})
