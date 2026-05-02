import cron, { type ScheduledTask } from 'node-cron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface ScheduledJob {
  name: string
  pattern: string
  script: string
  enabled: boolean
  category?: string
  lastRun?: string
  lastResult?: 'success' | 'error'
}

interface AppConfig {
  company?: { timezone?: string }
  agents?: Array<{ id: string; enabled: boolean }>
  scheduler?: { jobs: ScheduledJob[] }
  token_economy?: { audit_thresholds?: { daily_cost_alert_usd?: number } }
}

let appConfig: AppConfig = {}

function loadAppConfig(root: string): AppConfig {
  const configPath = path.join(root, 'config', 'app-config.json')
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch (err) {
    console.warn(`[Scheduler] Failed to load app-config.json: ${err}`)
  }
  return {}
}

function loadSchedules(): ScheduledJob[] {
  const jobs = appConfig.scheduler?.jobs
  if (jobs && jobs.length > 0) {
    return jobs.map(j => ({ ...j }))
  }
  return []
}

function getHeartbeatAgents(): string[] {
  const agents = appConfig.agents
  if (agents && agents.length > 0) {
    return agents
      .filter(a => a.enabled && a.id !== 'jarvis-coo')
      .map(a => a.id.replace(/-.*/, ''))
  }
  return ['hermione', 'luna', 'fred', 'percy', 'mcgonagall', 'dobby', 'snape', 'neville']
}

function getCostAlertThreshold(): number {
  return appConfig.token_economy?.audit_thresholds?.daily_cost_alert_usd ?? 10
}

function getTimezone(): string {
  return appConfig.company?.timezone ?? 'Asia/Shanghai'
}

let SCHEDULES: ScheduledJob[] = []

const STATE_FILENAME = 'scheduler-state.json'

interface SchedulerState {
  lastStartedAt: string
  jobs: Record<string, { lastRun?: string; lastResult?: string }>
}

function loadState(): SchedulerState | null {
  const statePath = path.join(projectRoot, 'output', STATE_FILENAME)
  if (!fs.existsSync(statePath)) return null
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8'))
  } catch {
    return null
  }
}

function saveState(): void {
  const stateDir = path.join(projectRoot, 'output')
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true })
  const statePath = path.join(stateDir, STATE_FILENAME)
  const state: SchedulerState = {
    lastStartedAt: new Date().toISOString(),
    jobs: {},
  }
  for (const job of SCHEDULES) {
    state.jobs[job.name] = { lastRun: job.lastRun, lastResult: job.lastResult }
  }
  try {
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8')
  } catch { /* ignore */ }
}

function restoreState(): void {
  const saved = loadState()
  if (!saved) return
  for (const job of SCHEDULES) {
    const s = saved.jobs[job.name]
    if (s) {
      job.lastRun = s.lastRun
      job.lastResult = s.lastResult as 'success' | 'error' | undefined
    }
  }
  logFn(`[Scheduler] Restored state from ${saved.lastStartedAt}`)
}

function checkMissedJobs(): void {
  const saved = loadState()
  if (!saved?.lastStartedAt) return

  const lastStart = new Date(saved.lastStartedAt)
  const now = new Date()
  const offlineHours = (now.getTime() - lastStart.getTime()) / (1000 * 60 * 60)

  if (offlineHours > 2) {
    logFn(`[Scheduler] Was offline for ${offlineHours.toFixed(1)}h, checking missed jobs...`)
    for (const job of SCHEDULES) {
      if (!job.enabled) continue
      const lastRun = job.lastRun ? new Date(job.lastRun) : null
      if (!lastRun || (now.getTime() - lastRun.getTime()) > 24 * 60 * 60 * 1000) {
        logFn(`[Scheduler] Running missed job: ${job.name}`)
        runScript(job)
      }
    }
  }
}

let projectRoot = ''
let logFn: (msg: string) => void = console.log
const activeJobs: ScheduledTask[] = []

const BACKEND_PORT = 18782

async function runBuiltinTask(job: ScheduledJob): Promise<void> {
  const script = job.script

  if (script.startsWith('__workflow__:')) {
    const workflowId = script.replace('__workflow__:', '')
    logFn(`[Scheduler] Triggering workflow: ${workflowId}`)
    try {
      const res = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/workflow/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId }),
      })
      job.lastResult = res.ok ? 'success' : 'error'
    } catch (err) {
      logFn(`[Scheduler] Workflow trigger failed: ${err}`)
      job.lastResult = 'error'
    }
    job.lastRun = new Date().toISOString()
    return
  }

  if (script === '__heartbeat__') {
    logFn(`[Scheduler] Running heartbeat proposals`)
    const agents = getHeartbeatAgents()
    for (const agent of agents) {
      try {
        await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/agents/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentKey: agent }),
        })
      } catch { /* best-effort */ }
    }
    job.lastRun = new Date().toISOString()
    job.lastResult = 'success'
    return
  }

  if (script === '__anomaly_detect__') {
    try {
      const res = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/llm/usage-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (res.ok) {
        const stats = await res.json() as { todayCost?: number; todayCalls?: number }
        const threshold = getCostAlertThreshold()
        if ((stats.todayCost ?? 0) > threshold) {
          const alertMsg = `⚠️ LLM 成本异常告警\n今日调用 ${stats.todayCalls} 次，成本 ¥${(stats.todayCost ?? 0).toFixed(2)} 超过阈值 ¥${threshold}。请检查是否有异常调用。`
          logFn(`[Scheduler] ANOMALY: Today LLM cost ¥${stats.todayCost} exceeds threshold`)
          await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `[自动] LLM 成本异常: ¥${(stats.todayCost ?? 0).toFixed(2)}`,
              description: alertMsg,
              taskType: 'audit',
              creatorAgentId: 'snape-audit',
              ownerAgentId: 'snape-audit',
              priority: 'high',
              budgetToken: 100,
              requiresApproval: false,
            }),
          })
          try {
            await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/feishu/notify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ msg_type: 'text', content: JSON.stringify({ text: alertMsg }) }),
            })
          } catch { /* feishu notify best-effort */ }
        }
      }
      job.lastResult = 'success'
    } catch {
      job.lastResult = 'error'
    }
    job.lastRun = new Date().toISOString()
    return
  }

  if (script === '__memory_decay__') {
    logFn(`[Scheduler] Running memory decay`)
    try {
      await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/memory/decay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      job.lastResult = 'success'
    } catch {
      job.lastResult = 'error'
    }
    job.lastRun = new Date().toISOString()
    return
  }

  if (script === '__performance_refresh_v2__') {
    logFn('[Scheduler] Refreshing performance review v2')
    try {
      const res = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/agents/performance/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 'v2' }),
      })
      job.lastResult = res.ok ? 'success' : 'error'
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        logFn(`[Scheduler] Performance refresh failed: ${text.slice(0, 300)}`)
      }
    } catch (err) {
      logFn(`[Scheduler] Performance refresh failed: ${err}`)
      job.lastResult = 'error'
    }
    job.lastRun = new Date().toISOString()
    return
  }
}

function runScript(job: ScheduledJob): void {
  if (job.script.startsWith('__')) {
    runBuiltinTask(job).catch(err => {
      logFn(`[Scheduler] Builtin task ${job.name} error: ${err}`)
      job.lastResult = 'error'
      job.lastRun = new Date().toISOString()
    })
    return
  }

  const scriptPath = path.join(projectRoot, 'scripts', job.script)
  if (!fs.existsSync(scriptPath)) {
    logFn(`[Scheduler] Script not found: ${scriptPath}`)
    job.lastRun = new Date().toISOString()
    job.lastResult = 'error'
    return
  }

  logFn(`[Scheduler] Running: ${job.name} (${job.script})`)
  const child = spawn('python', ['-u', scriptPath], {
    cwd: projectRoot,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    stdio: 'pipe',
    windowsHide: true,
  })

  let output = ''
  child.stdout?.on('data', (d) => { output += d.toString() })
  child.stderr?.on('data', (d) => { output += d.toString() })

  child.on('close', (code) => {
    job.lastRun = new Date().toISOString()
    job.lastResult = code === 0 ? 'success' : 'error'
    logFn(`[Scheduler] ${job.name} finished (code=${code})`)
    if (code !== 0 && output) {
      logFn(`[Scheduler] ${job.name} error output: ${output.slice(0, 500)}`)
    }
  })

  child.on('error', (err) => {
    job.lastRun = new Date().toISOString()
    job.lastResult = 'error'
    logFn(`[Scheduler] ${job.name} spawn error: ${err.message}`)
  })
}

export function startScheduler(root: string, log?: (msg: string) => void): void {
  projectRoot = root
  if (log) logFn = log

  appConfig = loadAppConfig(root)
  SCHEDULES = loadSchedules()
  logFn(`[Scheduler] Loaded ${SCHEDULES.length} jobs from config`)

  restoreState()
  checkMissedJobs()

  const tz = getTimezone()
  for (const job of SCHEDULES) {
    if (!job.enabled) continue
    if (!cron.validate(job.pattern)) {
      logFn(`[Scheduler] Invalid pattern for ${job.name}: ${job.pattern}`)
      continue
    }
    const task = cron.schedule(job.pattern, () => {
      runScript(job)
      saveState()
    }, {
      timezone: tz,
    })
    activeJobs.push(task)
    logFn(`[Scheduler] Registered: ${job.name} (${job.pattern})`)
  }

  saveState()
  logFn(`[Scheduler] Started with ${activeJobs.length} jobs (tz: ${tz})`)
}

export function stopScheduler(): void {
  for (const task of activeJobs) {
    task.stop()
  }
  activeJobs.length = 0
  logFn('[Scheduler] Stopped')
}

export function getScheduleStatus(): ScheduledJob[] {
  return SCHEDULES.map(j => ({ ...j }))
}
