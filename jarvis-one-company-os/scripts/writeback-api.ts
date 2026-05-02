import process from 'node:process'
import fs from 'node:fs'
import os from 'node:os'
import dotenv from 'dotenv'
import { spawn } from 'node:child_process'
import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPrismaClient } from './lib/prismaClient'
import {
  loadLatestPerformance,
  loadLatestPerformanceWithPrisma,
  loadPerformanceHistory,
  findPerformanceScript,
  dataRoot as performanceDataRoot,
} from './lib/performanceLoader'
import { evaluateAllAgentsV2, dumpReportToJson } from './lib/performanceEvaluator'
import { exportSnapshot } from './lib/exportSnapshot'

function detectOutboundLocalAddress(): string | undefined {
  const preferred = (process.env.LLM_LOCAL_ADDRESS ?? '').trim()
  if (preferred) return preferred

  const ifaces = os.networkInterfaces()
  const vpnNames = /^(lets?tap|tun|tap|wg|tailscale|zerotier)/i
  const candidates: { name: string; address: string; priority: number }[] = []

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue
    for (const a of addrs) {
      if (a.family !== 'IPv4' || a.internal) continue
      if (vpnNames.test(name)) continue
      const p = /^(wi-?fi|wlan|ethernet|eth)/i.test(name) ? 10 : 5
      candidates.push({ name, address: a.address, priority: p })
    }
  }

  candidates.sort((a, b) => b.priority - a.priority)
  const chosen = candidates[0]
  if (chosen) {
    console.log(`Outbound localAddress: ${chosen.address} (${chosen.name})`)
    return chosen.address
  }
  return undefined
}

const OUTBOUND_LOCAL_ADDRESS = detectOutboundLocalAddress()

type CreateTaskPayload = {
  title: string
  description: string
  taskType: 'ops' | 'tech' | 'growth' | 'finance' | 'audit' | 'product' | 'sales' | 'customer'
  creatorAgentId: string
  ownerAgentId: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  budgetToken: number
  dueAt?: string
  requiresApproval: boolean
  approverId?: string
  taskId?: string
  sourceApprovalId?: string
}

type ApprovalDecisionPayload = {
  approvalId: string
  status: 'approved' | 'rejected'
  decisionNote?: string
}

type PurchaseStoreItemPayload = {
  buyerAgentId: string
  itemId: string
  quantity: number
}

type PaySalaryPayload = {
  agentId?: string
}

type AddRevenuePayload = {
  title: string
  businessLine: string
  source: string
  amountFiat: number
  mappedToken: number
  relatedTaskId?: string
  note?: string
}

type UpdateAuditPayload = {
  eventId: string
  status: 'resolved' | 'ignored'
  freezeTask?: boolean
}

type ExecuteTaskOpenClawPayload = {
  taskId: string
  operatorId?: string
  dryRun?: boolean
}

type RunAuditInspectionPayload = {
  scope?: 'all' | 'recent'
}

type UpdateTaskStatusPayload = {
  taskId: string
  action: 'start' | 'submit_review' | 'complete' | 'freeze'
  operatorId: string
  note?: string
}

type JsonRecord = Record<string, unknown>

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const dataRoot = (process.env.JARVIS_COMPANY_DATA_DIR ?? '').trim() || path.resolve(projectRoot, '..')
const envCandidates = [
  path.resolve(projectRoot, '.env'),
  path.resolve(__dirname, '.env'),
]
const envPath = envCandidates.find(p => fs.existsSync(p)) ?? envCandidates[0]
dotenv.config({ path: envPath, override: true })
const port = Number(process.env.WRITEBACK_API_PORT ?? 18782)
const prisma = createPrismaClient()

function sendJson(response: import('node:http').ServerResponse, statusCode: number, payload: JsonRecord) {
  const body = JSON.stringify(payload)
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  response.end(body)
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}


function validateCreateTaskPayload(payload: unknown): payload is CreateTaskPayload {
  return isRecord(payload)
    && typeof payload.title === 'string'
    && typeof payload.description === 'string'
    && ['ops', 'tech', 'growth', 'finance', 'audit', 'product', 'sales', 'customer'].includes(String(payload.taskType))
    && typeof payload.creatorAgentId === 'string'
    && typeof payload.ownerAgentId === 'string'
    && ['low', 'medium', 'high', 'urgent'].includes(String(payload.priority))
    && typeof payload.budgetToken === 'number'
    && typeof payload.requiresApproval === 'boolean'
    && (payload.dueAt === undefined || typeof payload.dueAt === 'string')
    && (payload.approverId === undefined || typeof payload.approverId === 'string')
    && (payload.taskId === undefined || typeof payload.taskId === 'string')
    && (payload.sourceApprovalId === undefined || typeof payload.sourceApprovalId === 'string')
}

function validateDecisionPayload(payload: unknown): payload is ApprovalDecisionPayload {
  return isRecord(payload)
    && typeof payload.approvalId === 'string'
    && (payload.status === 'approved' || payload.status === 'rejected')
    && (payload.decisionNote === undefined || typeof payload.decisionNote === 'string')
}

function validatePurchasePayload(payload: unknown): payload is PurchaseStoreItemPayload {
  return isRecord(payload)
    && typeof payload.buyerAgentId === 'string'
    && typeof payload.itemId === 'string'
    && typeof payload.quantity === 'number'
    && payload.quantity > 0
}

function validatePaySalaryPayload(payload: unknown): payload is PaySalaryPayload {
  return isRecord(payload)
    && (payload.agentId === undefined || typeof payload.agentId === 'string')
}

function validateAddRevenuePayload(payload: unknown): payload is AddRevenuePayload {
  return isRecord(payload)
    && typeof payload.title === 'string'
    && typeof payload.businessLine === 'string'
    && typeof payload.source === 'string'
    && typeof payload.amountFiat === 'number'
    && typeof payload.mappedToken === 'number'
}

function validateUpdateAuditPayload(payload: unknown): payload is UpdateAuditPayload {
  return isRecord(payload)
    && typeof payload.eventId === 'string'
    && (payload.status === 'resolved' || payload.status === 'ignored')
}

function validateExecuteTaskPayload(payload: unknown): payload is ExecuteTaskOpenClawPayload {
  return isRecord(payload)
    && typeof payload.taskId === 'string'
    && (payload.operatorId === undefined || typeof payload.operatorId === 'string')
    && (payload.dryRun === undefined || typeof payload.dryRun === 'boolean')
}

function validateRunAuditInspectionPayload(payload: unknown): payload is RunAuditInspectionPayload {
  return isRecord(payload)
    && (payload.scope === undefined || payload.scope === 'all' || payload.scope === 'recent')
}

function validateUpdateTaskStatusPayload(payload: unknown): payload is UpdateTaskStatusPayload {
  return isRecord(payload)
    && typeof payload.taskId === 'string'
    && ['start', 'submit_review', 'complete', 'freeze'].includes(String(payload.action))
    && typeof payload.operatorId === 'string'
}

async function readJsonBody(request: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return {}
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function resolveScript(scriptFile: string): { exe: string; args: string[] } {
  const distBackendDir = path.resolve(projectRoot, 'dist-backend')
  const baseName = path.basename(scriptFile).replace(/\.ts$/, '.js')
  const bundled = path.resolve(distBackendDir, baseName)
  if (fs.existsSync(bundled)) {
    const env = process.env.ELECTRON_RUN_AS_NODE ? {} : { ELECTRON_RUN_AS_NODE: '1' }
    return { exe: process.execPath, args: [bundled], ...env }
  }
  const tsxCli = path.resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')
  return { exe: process.execPath, args: [tsxCli, scriptFile] }
}

function runPythonScript(scriptFile: string, args: string[] = [], options: { cwd?: string } = {}) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    const python = process.env.PYTHON_EXECUTABLE || (process.platform === 'win32' ? 'python' : 'python3')
    const child = spawn(python, [scriptFile, ...args], {
      cwd: options.cwd ?? path.dirname(scriptFile),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', (err) => { resolve({ stdout, stderr: stderr + String(err), code: -1 }) })
    child.on('close', (code) => { resolve({ stdout, stderr, code: code ?? -1 }) })
  })
}

function runScript(scriptFile: string, payload: JsonRecord) {
  return new Promise<JsonRecord>((resolve, reject) => {
    const { exe, args } = resolveScript(scriptFile)
    const child = spawn(exe, [...args, JSON.stringify(payload)], {
      cwd: projectRoot,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `Script exited with code ${code}`))
        return
      }

      try {
        resolve(JSON.parse(stdout) as JsonRecord)
      } catch {
        reject(new Error(`Invalid script output: ${stdout}`))
      }
    })
  })
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { ok: false, error: 'Missing request URL' })
    return
  }

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, { ok: true, port })
    return
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { ok: false, error: 'Method not allowed' })
    return
  }

  try {
    const payload = await readJsonBody(request)

    if (request.url === '/api/writeback/create-task') {
      if (!validateCreateTaskPayload(payload)) {
        sendJson(response, 400, { ok: false, error: 'Invalid create-task payload' })
        return
      }

      const result = await runScript(path.resolve(projectRoot, 'scripts/create-task.ts'), payload)
      sendJson(response, 200, { ok: true, ...result })
      return
    }

    if (request.url === '/api/writeback/decide-approval') {
      if (!validateDecisionPayload(payload)) {
        sendJson(response, 400, { ok: false, error: 'Invalid decide-approval payload' })
        return
      }

      const result = await runScript(path.resolve(projectRoot, 'scripts/decide-approval.ts'), payload)
      sendJson(response, 200, { ok: true, ...result })
      return
    }

    if (request.url === '/api/writeback/purchase-store-item') {
      if (!validatePurchasePayload(payload)) {
        sendJson(response, 400, { ok: false, error: 'Invalid purchase payload' })
        return
      }

      const result = await runScript(path.resolve(projectRoot, 'scripts/purchase-store-item.ts'), payload)
      sendJson(response, 200, { ok: true, ...result })
      return
    }

    if (request.url === '/api/writeback/pay-salary') {
      if (!validatePaySalaryPayload(payload)) {
        sendJson(response, 400, { ok: false, error: 'Invalid pay-salary payload' })
        return
      }

      const result = await runScript(path.resolve(projectRoot, 'scripts/pay-salary.ts'), payload)
      sendJson(response, 200, { ok: true, ...result })
      return
    }

    if (request.url === '/api/writeback/add-revenue') {
      if (!validateAddRevenuePayload(payload)) {
        sendJson(response, 400, { ok: false, error: 'Invalid add-revenue payload' })
        return
      }

      const result = await runScript(path.resolve(projectRoot, 'scripts/add-revenue.ts'), payload)
      sendJson(response, 200, { ok: true, ...result })
      return
    }

    if (request.url === '/api/writeback/update-task-status') {
      if (!validateUpdateTaskStatusPayload(payload)) {
        sendJson(response, 400, { ok: false, error: 'Invalid update-task-status payload' })
        return
      }

      const result = await runScript(path.resolve(projectRoot, 'scripts/update-task-status.ts'), payload)
      sendJson(response, 200, { ok: true, ...result })
      return
    }

    if (request.url === '/api/writeback/update-audit') {
      if (!validateUpdateAuditPayload(payload)) {
        sendJson(response, 400, { ok: false, error: 'Invalid update-audit payload' })
        return
      }

      const result = await runScript(path.resolve(projectRoot, 'scripts/update-audit.ts'), payload)
      sendJson(response, 200, { ok: true, ...result })
      return
    }

    if (request.url === '/api/writeback/execute-task-openclaw') {
      if (!validateExecuteTaskPayload(payload)) {
        sendJson(response, 400, { ok: false, error: 'Invalid execute-task payload' })
        return
      }

      const result = await runScript(path.resolve(projectRoot, 'scripts/execute-task-openclaw.ts'), payload)
      sendJson(response, 200, { ok: true, ...result })
      return
    }

    if (request.url === '/api/writeback/audit-inspection') {
      if (!validateRunAuditInspectionPayload(payload)) {
        sendJson(response, 400, { ok: false, error: 'Invalid audit-inspection payload' })
        return
      }

      const result = await runScript(path.resolve(projectRoot, 'scripts/audit-inspection.ts'), payload)
      sendJson(response, 200, { ok: true, ...result })
      return
    }

    if (request.url === '/api/agents/performance') {
      const report = await loadLatestPerformanceWithPrisma(prisma).catch(() => null)
      if (!report) {
        sendJson(response, 200, { ok: true, hasReport: false })
        return
      }
      sendJson(response, 200, {
        ok: true,
        hasReport: true,
        reviewDate: report.reviewDate,
        reviewer: report.reviewer,
        avgScore: report.avgScore,
        gradeDistribution: report.gradeDistribution,
        topPerformer: report.topPerformer,
        needsAttention: report.needsAttention,
        records: report.records,
      } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/agents/performance/history') {
      const body = payload as { agentCode?: string; limit?: number }
      const agentCode = String(body.agentCode ?? '').trim()
      if (!agentCode) {
        sendJson(response, 400, { ok: false, error: 'agentCode required' })
        return
      }
      const limit = Number.isFinite(Number(body.limit)) ? Number(body.limit) : 20
      const history = await loadPerformanceHistory(prisma, agentCode, limit).catch(() => [])
      sendJson(response, 200, { ok: true, agentCode, history } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/agents/performance/refresh') {
      const body = payload as { version?: string }
      const requestedVersion = String(body.version ?? 'v2').toLowerCase() === 'v1' ? 'v1' : 'v2'

      if (requestedVersion === 'v1') {
        const script = findPerformanceScript()
        if (!script || !fs.existsSync(script)) {
          sendJson(response, 404, { ok: false, error: `Performance script not found: ${script}` })
          return
        }
        const exec = await runPythonScript(script, [], { cwd: performanceDataRoot() })
        if (exec.code !== 0) {
          sendJson(response, 500, {
            ok: false,
            error: `Python exited with code ${exec.code}`,
            stderr: exec.stderr.slice(-2000),
            stdout: exec.stdout.slice(-2000),
          })
          return
        }
        try { await exportSnapshot(prisma) } catch (err) { console.warn('[performance/refresh v1] exportSnapshot failed:', err) }
        const report = await loadLatestPerformance().catch(() => null)
        sendJson(response, 200, {
          ok: true,
          version: 'v1',
          refreshedAt: new Date().toISOString(),
          reviewDate: report?.reviewDate,
          avgScore: report?.avgScore,
          gradeDistribution: report?.gradeDistribution,
          totalAgents: report?.records.length ?? 0,
          stdoutTail: exec.stdout.slice(-500),
        } as unknown as JsonRecord)
        return
      }

      try {
        const report = await evaluateAllAgentsV2(prisma, { persist: true })
        const jsonPath = dumpReportToJson(report)
        try { await exportSnapshot(prisma) } catch (err) { console.warn('[performance/refresh v2] exportSnapshot failed:', err) }
        sendJson(response, 200, {
          ok: true,
          version: 'v2',
          refreshedAt: new Date().toISOString(),
          reviewDate: report.reviewDate,
          avgScore: report.avgScore,
          gradeDistribution: report.gradeDistribution,
          totalAgents: report.records.length,
          jsonPath,
        } as unknown as JsonRecord)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        sendJson(response, 500, { ok: false, version: 'v2', error: msg })
      }
      return
    }

    if (request.url === '/api/llm/models' && request.method === 'POST') {
      const providers = buildLlmProviderChain()
      const defaultProviderId = (process.env.VITE_LLM_DEFAULT_PROVIDER ?? 'fandai-gemini-31').trim() || 'fandai-gemini-31'

      const MODEL_DESCRIPTIONS: Record<string, string> = {
        'fandai-nn-46': 'Claude 4.6 Opus · 高性能推理',
        'fandai-gemini-31': 'Gemini 3.1 Flash · 稳定快速',
        'fandai-glm-5': '智谱 GLM-5 · 稳定可用',
        'siliconflow': 'DeepSeek-V3 · 需检查授权',
        'ollama-local': '本地 Ollama · 需启动服务',
      }

      function getModelDescription(name: string): string | undefined {
        if (MODEL_DESCRIPTIONS[name]) return MODEL_DESCRIPTIONS[name]
        if (name.startsWith('chatgpt-plus-')) return 'ChatGPT Plus · 你的订阅账号 via CLIProxyAPI'
        if (name.startsWith('openai-direct-')) return 'OpenAI API 直连'
        return undefined
      }

      const models = [
        { id: 'cascade', name: '自动级联 (Auto)', description: '按优先级依次尝试所有可用模型', provider: 'auto', isDefault: defaultProviderId === 'cascade' },
        ...providers.map(p => ({
          id: p.name,
          name: p.modelOverride ?? p.name,
          description: getModelDescription(p.name) ?? `${p.name} → ${p.baseUrl.replace(/https?:\/\//, '').replace(/\/v1$/, '')}`,
          provider: p.name,
          isDefault: p.name === defaultProviderId || (p.modelOverride ?? '') === defaultProviderId,
        })),
      ]
      sendJson(response, 200, { ok: true, models } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/llm/fallback-config' && request.method === 'POST') {
      const providers = buildLlmProviderChain()
      const providerFallbackMap = parseProviderFallbackMap(process.env.LLM_PROVIDER_FALLBACKS)
      const items = providers.map(p => ({
        provider: p.name,
        model: p.modelOverride ?? p.name,
        fallbackTo: providerFallbackMap[p.name] ?? p.fallbackTo ?? [],
      }))
      sendJson(response, 200, { ok: true, items } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/llm/fallback-config/save' && request.method === 'POST') {
      const body = payload as { items?: Array<{ provider?: string; fallbackTo?: string[] }> }
      const items = Array.isArray(body.items) ? body.items : []
      const nextMap = items.reduce<Record<string, string[]>>((acc, item) => {
        const provider = String(item.provider ?? '').trim()
        const fallbackTo = Array.isArray(item.fallbackTo) ? item.fallbackTo.map(name => String(name).trim()).filter(Boolean) : []
        if (provider && fallbackTo.length > 0) {
          acc[provider] = fallbackTo
        }
        return acc
      }, {})
      const serialized = serializeProviderFallbackMap(nextMap)
      const envPath = path.resolve(projectRoot, '.env')
      updateDotEnvValue(envPath, 'LLM_PROVIDER_FALLBACKS', serialized)
      process.env.LLM_PROVIDER_FALLBACKS = serialized
      sendJson(response, 200, { ok: true, saved: serialized } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/llm/chat') {
      const body = payload as Record<string, unknown>

      const openaiKey = (process.env.OPENAI_API_KEY ?? '').trim()
      const deepseekKey = (process.env.DEEPSEEK_API_KEY ?? '').trim()
      const moonshotKey = (process.env.MOONSHOT_API_KEY ?? '').trim()
      const siliconflowKey = (process.env.SILICONFLOW_API_KEY ?? '').trim()
      const openaiBase = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').trim()
      const providers = buildLlmProviderChain()
      const requestModel = String(body.model ?? '')
      const targetProvider = String(body.provider ?? '')

      let replied = false
      const safeReply = (statusCode: number, resBody: string) => {
        if (replied) return
        replied = true
        try {
          response.writeHead(statusCode, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          })
          response.end(resBody)
        } catch { /* response already closed */ }
      }

      const providerFailures: Array<{ provider: string; status?: number; body?: string; error?: string }> = []

      async function tryProvider(provider: LlmProvider): Promise<boolean> {
        const resolvedModel = provider.modelOverride ?? requestModel
        const postBody = JSON.stringify({ ...body, model: resolvedModel, provider: undefined })
        const targetUrl = new URL(`${provider.baseUrl}/chat/completions`)
        const isHttps = targetUrl.protocol === 'https:'
        const reqFn = isHttps ? httpsRequest : httpRequest
        const isLocal = targetUrl.hostname === '127.0.0.1' || targetUrl.hostname === 'localhost'

        return new Promise<boolean>((resolve) => {
          const proxyReq = reqFn({
          hostname: targetUrl.hostname,
          port: targetUrl.port || (isHttps ? 443 : 80),
          path: targetUrl.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postBody),
              ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
          },
            timeout: 30000,
            ...(!isLocal && OUTBOUND_LOCAL_ADDRESS ? { localAddress: OUTBOUND_LOCAL_ADDRESS } : {}),
          }, (proxyRes) => {
          let resBody = ''
          proxyRes.on('data', (chunk: Buffer) => { resBody += chunk.toString() })
          proxyRes.on('end', () => {
              const code = proxyRes.statusCode ?? 0
              const isRetryable = code === 401 || code === 403 || code === 404 || code === 429 || code >= 500
              if (code >= 200 && code < 300) {
                try {
                  const parsed = JSON.parse(resBody)
                  const msg = parsed?.choices?.[0]?.message
                  if (msg && (!msg.content || msg.content.trim() === '') && msg.reasoning_content) {
                    msg.content = msg.reasoning_content
                    resBody = JSON.stringify(parsed)
                  }
                  const finalContent = parsed?.choices?.[0]?.message?.content ?? ''
                  if (!finalContent || finalContent.trim() === '') {
                    console.log(`LLM provider ${provider.name} returned empty content, trying next`)
                    resolve(false)
                    return
                  }
                  if (parsed && !parsed.model_provider) {
                    parsed.model_provider = provider.name
                    parsed.model_display = provider.modelOverride ?? provider.name
                    resBody = JSON.stringify(parsed)
                  }
                } catch { /* not JSON or parse failed, pass through */ }
                safeReply(code, resBody)
                resolve(true)
              } else if (isRetryable) {
                providerFailures.push({ provider: provider.name, status: code, body: resBody.slice(0, 500) })
                console.log(`LLM provider ${provider.name} returned ${code}, will try next`)
                resolve(false)
              } else {
                safeReply(code, resBody)
                resolve(true)
              }
            })
            proxyRes.on('error', (err) => {
              providerFailures.push({ provider: provider.name, error: String(err) })
              resolve(false)
            })
          })
          proxyReq.on('error', (err) => {
            providerFailures.push({ provider: provider.name, error: String(err) })
            resolve(false)
          })
          proxyReq.on('timeout', () => {
            providerFailures.push({ provider: provider.name, error: 'timeout' })
            proxyReq.destroy()
            resolve(false)
          })
          proxyReq.write(postBody)
          proxyReq.end()
        })
      }

      ;(async () => {
        const selectedProviders = targetProvider && targetProvider !== 'cascade'
          ? (() => {
              const primary = providers.find(p => p.name === targetProvider)
              if (!primary) return []
              const fallbackNames = primary.fallbackTo ?? []
              const fallbackProviders = fallbackNames
                .map(name => providers.find(p => p.name === name))
                .filter((provider): provider is LlmProvider => Boolean(provider))
              return [primary, ...fallbackProviders]
            })()
          : providers

        if (selectedProviders.length === 0) {
          safeReply(400, JSON.stringify({ ok: false, error: `Unknown provider: ${targetProvider}` }))
          return
        }

        const failedProviders: string[] = []
        for (const provider of selectedProviders) {
          const ok = await tryProvider(provider)
          if (ok) return
          failedProviders.push(`${provider.name}${provider.modelOverride ? `(${provider.modelOverride})` : ''}`)
          console.log(`LLM provider ${provider.name} failed, trying next...`)
        }
        safeReply(502, JSON.stringify({
          ok: false,
          error: 'All LLM providers failed. Check API keys and network.',
          attemptedProviders: failedProviders,
          providerFailures,
          envSummary: {
            openaiKeyPresent: !!openaiKey,
            openaiBase,
            deepseekKeyPresent: !!deepseekKey,
            moonshotKeyPresent: !!moonshotKey,
            siliconflowKeyPresent: !!siliconflowKey,
          },
        }))
      })()
      return
    }

    if (request.url === '/api/llm/chat-stream') {
      const body = payload as Record<string, unknown>
      const providers = buildLlmProviderChain()
      const requestModel = String(body.model ?? '')
      const targetProvider = String(body.provider ?? '')

      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })

      const selectedProviders = targetProvider && targetProvider !== 'cascade'
        ? (() => {
            const primary = providers.find(p => p.name === targetProvider)
            if (!primary) return []
            const fallbackNames = primary.fallbackTo ?? []
            const fallbackProviders = fallbackNames
              .map(name => providers.find(p => p.name === name))
              .filter((p): p is LlmProvider => Boolean(p))
            return [primary, ...fallbackProviders]
          })()
        : providers

      if (selectedProviders.length === 0) {
        response.write(`data: ${JSON.stringify({ error: 'No providers available' })}\n\n`)
        response.end()
        return
      }

      let streamed = false

      for (const provider of selectedProviders) {
        if (streamed) break
        const resolvedModel = provider.modelOverride ?? requestModel
        const postBody = JSON.stringify({ ...body, model: resolvedModel, provider: undefined, stream: true })
        const targetUrl = new URL(`${provider.baseUrl}/chat/completions`)
        const isHttps = targetUrl.protocol === 'https:'
        const reqFn = isHttps ? httpsRequest : httpRequest
        const isLocal = targetUrl.hostname === '127.0.0.1' || targetUrl.hostname === 'localhost'

        try {
          streamed = await new Promise<boolean>((resolve) => {
            const proxyReq = reqFn({
              hostname: targetUrl.hostname,
              port: targetUrl.port || (isHttps ? 443 : 80),
              path: targetUrl.pathname,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postBody),
                ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
              },
              timeout: 60000,
              ...(!isLocal && OUTBOUND_LOCAL_ADDRESS ? { localAddress: OUTBOUND_LOCAL_ADDRESS } : {}),
            }, (proxyRes) => {
              if ((proxyRes.statusCode ?? 0) >= 400) {
                resolve(false)
                return
              }
              proxyRes.on('data', (chunk: Buffer) => {
                response.write(chunk)
              })
              proxyRes.on('end', () => {
                response.write(`data: [DONE]\n\n`)
                response.end()
                resolve(true)
              })
              proxyRes.on('error', () => resolve(false))
            })
            proxyReq.on('error', () => resolve(false))
            proxyReq.on('timeout', () => { proxyReq.destroy(); resolve(false) })
            proxyReq.write(postBody)
            proxyReq.end()
          })
        } catch {
          continue
        }
      }

      if (!streamed) {
        response.write(`data: ${JSON.stringify({ error: 'All providers failed for streaming' })}\n\n`)
        response.end()
      }
      return
    }

    if (request.url === '/api/openclaw/agent-chat') {
      const body = payload as { agentId?: string; task?: string; timeoutSeconds?: number }
      if (!body.agentId || !body.task) {
        sendJson(response, 400, { ok: false, error: 'agentId and task are required' })
        return
      }

      const configPath = path.resolve(projectRoot, 'config', 'openclaw-agents.json')
      let openclawBase = 'http://127.0.0.1:18789'
      try {
        const agentsConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { openclawApiBase?: string }
        openclawBase = agentsConfig.openclawApiBase ?? openclawBase
      } catch { /* use default */ }

      const spawnPayload = JSON.stringify({
        agentId: body.agentId,
        task: body.task,
        runTimeoutSeconds: body.timeoutSeconds ?? 120,
        cleanup: 'delete',
      })

      const spawnUrl = new URL(`${openclawBase}/api/sessions/spawn`)
      const isSpawnHttps = spawnUrl.protocol === 'https:'
      const spawnReqFn = isSpawnHttps ? httpsRequest : httpRequest

      let spawnReplied = false
      const safeSendSpawn = (statusCode: number, resBody: string) => {
        if (spawnReplied) return
        spawnReplied = true
        try {
          response.writeHead(statusCode, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
          })
          response.end(resBody)
        } catch { /* closed */ }
      }

      const spawnReq = spawnReqFn({
        hostname: spawnUrl.hostname,
        port: spawnUrl.port || (isSpawnHttps ? 443 : 80),
        path: spawnUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(spawnPayload),
        },
        timeout: (body.timeoutSeconds ?? 120) * 1000 + 30000,
      }, (proxyRes) => {
        let resBody = ''
        proxyRes.on('data', (chunk: Buffer) => { resBody += chunk.toString() })
        proxyRes.on('end', () => {
          try {
            const spawnData = JSON.parse(resBody) as { sessionId?: string; status?: string; result?: string }
            if (spawnData.sessionId) {
              pollOpenClawSession(openclawBase, spawnData.sessionId, body.timeoutSeconds ?? 120)
                .then(result => safeSendSpawn(200, JSON.stringify(result)))
                .catch(err => safeSendSpawn(502, JSON.stringify({ ok: false, error: String(err) })))
            } else {
              safeSendSpawn(proxyRes.statusCode ?? 502, resBody)
            }
          } catch {
            safeSendSpawn(proxyRes.statusCode ?? 502, resBody)
          }
        })
      })
      spawnReq.on('error', (err) => {
        safeSendSpawn(502, JSON.stringify({ ok: false, error: `OpenClaw 未运行或不可达: ${err.message}` }))
      })
      spawnReq.on('timeout', () => { spawnReq.destroy(); safeSendSpawn(504, JSON.stringify({ ok: false, error: 'OpenClaw 请求超时' })) })
      spawnReq.write(spawnPayload)
      spawnReq.end()
      return
    }

    if (request.url === '/api/agents/identities' && request.method === 'POST') {
      const agentsDir = path.resolve(dataRoot, 'openclaw_agents')
      const orgChartPath = path.join(agentsDir, 'ORG_CHART.md')
      const agents: { id: string; identity: string }[] = []

      if (fs.existsSync(agentsDir)) {
        for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          const idPath = path.join(agentsDir, entry.name, 'IDENTITY.md')
          if (!fs.existsSync(idPath)) continue
          try {
            agents.push({ id: entry.name, identity: fs.readFileSync(idPath, 'utf-8') })
          } catch { /* skip */ }
        }
      }

      let orgChart = ''
      if (fs.existsSync(orgChartPath)) {
        try { orgChart = fs.readFileSync(orgChartPath, 'utf-8') } catch { /* skip */ }
      }

      sendJson(response, 200, { ok: true, agents, orgChart } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/agents/memory' && request.method === 'POST') {
      const body = payload as { agentId?: string; file?: string; content?: string; action?: string }
      const agentsDir = path.resolve(dataRoot, 'openclaw_agents')
      const agentId = body.agentId ?? ''
      const memFile = body.file ?? 'learnings.md'

      const allowedFiles = ['learnings.md', 'ceo_preferences.md', 'decisions.md', 'work_log.md']
      if (!allowedFiles.includes(memFile)) {
        sendJson(response, 400, { ok: false, error: `Invalid memory file: ${memFile}` })
        return
      }

      const agentDir = fs.readdirSync(agentsDir, { withFileTypes: true })
        .find(e => e.isDirectory() && e.name.includes(agentId))
      if (!agentDir) {
        sendJson(response, 404, { ok: false, error: `Agent not found: ${agentId}` })
        return
      }

      const memDir = path.join(agentsDir, agentDir.name, 'memory')
      const memPath = path.join(memDir, memFile)

      if (body.action === 'read') {
        let content = ''
        if (fs.existsSync(memPath)) {
          try { content = fs.readFileSync(memPath, 'utf-8') } catch { /* empty */ }
        }
        sendJson(response, 200, { ok: true, content } as unknown as JsonRecord)
        return
      }

      if (body.action === 'write' && body.content !== undefined) {
        if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true })
        fs.writeFileSync(memPath, body.content, 'utf-8')
        sendJson(response, 200, { ok: true })
        return
      }

      if (body.action === 'append' && body.content !== undefined) {
        if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true })
        const existing = fs.existsSync(memPath) ? fs.readFileSync(memPath, 'utf-8') : ''
        const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
        const newContent = existing + `\n\n---\n_${timestamp}_\n${body.content}`
        fs.writeFileSync(memPath, newContent.trim(), 'utf-8')
        sendJson(response, 200, { ok: true })
        return
      }

      if (body.action === 'list') {
        const files: string[] = []
        if (fs.existsSync(memDir)) {
          for (const f of fs.readdirSync(memDir)) {
            if (f.endsWith('.md') || f.endsWith('.json')) files.push(f)
          }
        }
        sendJson(response, 200, { ok: true, files } as unknown as JsonRecord)
        return
      }

      sendJson(response, 400, { ok: false, error: 'action must be read/write/append/list' })
      return
    }

    if (request.url === '/api/agents/memory/all' && request.method === 'POST') {
      const agentsDir = path.resolve(dataRoot, 'openclaw_agents')
      const result: Record<string, Record<string, string>> = {}

      if (fs.existsSync(agentsDir)) {
        for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          const memDir = path.join(agentsDir, entry.name, 'memory')
          if (!fs.existsSync(memDir)) continue
          result[entry.name] = {}
          for (const f of fs.readdirSync(memDir)) {
            if (!f.endsWith('.md')) continue
            try {
              result[entry.name][f] = fs.readFileSync(path.join(memDir, f), 'utf-8')
            } catch { /* skip */ }
          }
        }
      }

      sendJson(response, 200, { ok: true, memories: result } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/company/app-config' && request.method === 'POST') {
      const configPath = path.resolve(dataRoot, 'config', 'app-config.json')
      if (fs.existsSync(configPath)) {
        try {
          const raw = fs.readFileSync(configPath, 'utf-8')
          const cfg = JSON.parse(raw) as JsonRecord
          sendJson(response, 200, cfg)
        } catch {
          sendJson(response, 500, { ok: false, error: 'parse error' } as unknown as JsonRecord)
        }
      } else {
        sendJson(response, 404, { ok: false, error: 'app-config.json not found' } as unknown as JsonRecord)
      }
      return
    }

    if (request.url === '/api/company/runtime-status' && request.method === 'POST') {
      const candidates = [
        path.resolve(dataRoot, 'output', 'coo_ops', 'runtime-status.json'),
        path.resolve(projectRoot, '..', 'output', 'coo_ops', 'runtime-status.json'),
      ]
      const statusPath = candidates.find((candidate) => fs.existsSync(candidate))
      if (!statusPath) {
        sendJson(response, 404, { ok: false, error: 'runtime-status.json not found' } as unknown as JsonRecord)
        return
      }

      try {
        const snapshot = JSON.parse(fs.readFileSync(statusPath, 'utf-8')) as JsonRecord
        sendJson(response, 200, { ok: true, snapshot, path: path.relative(dataRoot, statusPath) } as unknown as JsonRecord)
      } catch (err) {
        sendJson(response, 500, { ok: false, error: String(err) } as unknown as JsonRecord)
      }
      return
    }

    if (request.url === '/api/company/app-config/update' && request.method === 'POST') {
      const configPath = path.resolve(dataRoot, 'config', 'app-config.json')
      try {
        const newCfg = payload as JsonRecord
        fs.writeFileSync(configPath, JSON.stringify(newCfg, null, 2), 'utf-8')

        syncLlmConfigToEnv(newCfg)

        sendJson(response, 200, { ok: true } as unknown as JsonRecord)
      } catch (err) {
        sendJson(response, 500, { ok: false, error: String(err) } as unknown as JsonRecord)
      }
      return
    }

    if (request.url === '/api/company/rules' && request.method === 'POST') {
      const rulesPath = path.resolve(dataRoot, 'config', 'company-rules.md')
      let content = ''
      if (fs.existsSync(rulesPath)) {
        try { content = fs.readFileSync(rulesPath, 'utf-8') } catch { /* empty */ }
      }
      sendJson(response, 200, { ok: true, content } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/company/config-file' && request.method === 'POST') {
      const body = payload as { file?: string }
      const file = body.file ?? ''
      const allowedExts = ['.md', '.json']
      const ext = path.extname(file).toLowerCase()
      if (!file || !allowedExts.includes(ext) || file.includes('..') || file.includes('/') || file.includes('\\')) {
        sendJson(response, 400, { ok: false, error: 'file not allowed' } as unknown as JsonRecord)
        return
      }
      const filePath = path.resolve(dataRoot, 'config', file)
      let content = ''
      if (fs.existsSync(filePath)) {
        try { content = fs.readFileSync(filePath, 'utf-8') } catch { /* empty */ }
      }
      sendJson(response, 200, { ok: true, content } as unknown as JsonRecord)
      return
    }

    // ─── 全公司统一技能引擎 ───

    if (request.url === '/api/skills/list' && request.method === 'POST') {
      const body = payload as { agentId?: string }
      const agentsRoot = path.resolve(dataRoot, 'openclaw_agents')
      const allSkills: { id: string; name: string; description: string; agentId: string; agentName: string; type: string; available: boolean }[] = []

      let agentNames: Record<string, string> = {
        'jarvis-coo': '贾维斯', 'hermione-tech': '赫敏', 'mcgonagall-product': '麦格教授',
        'luna-growth': '卢娜', 'fred-sales': '弗雷德', 'percy-finance': '珀西',
        'snape-audit': '斯内普', 'dobby-customer': '多比', 'req-review-agent': '需求审核',
      }
      const appCfgPath = path.resolve(dataRoot, 'config', 'app-config.json')
      try {
        if (fs.existsSync(appCfgPath)) {
          const appCfg = JSON.parse(fs.readFileSync(appCfgPath, 'utf-8')) as { agents?: { id: string; display_name: string }[] }
          if (appCfg.agents?.length) {
            const fromCfg: Record<string, string> = {}
            for (const a of appCfg.agents) fromCfg[a.id] = a.display_name
            fromCfg['req-review-agent'] = '需求审核'
            agentNames = fromCfg
          }
        }
      } catch { /* fallback to defaults */ }

      for (const [agentId, agentName] of Object.entries(agentNames)) {
        const skillsPath = path.join(agentsRoot, agentId, 'skills.json')
        if (!fs.existsSync(skillsPath)) continue
        try {
          const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf-8')) as { id: string; name: string; description: string; type: string; script?: string }[]
          for (const s of skills) {
            let available = true
            if (s.type === 'script' && s.script) {
              available = fs.existsSync(path.join(agentsRoot, agentId, s.script))
            }
            if (!body.agentId || body.agentId === agentId) {
              allSkills.push({ id: s.id, name: s.name, description: s.description, agentId, agentName, type: s.type, available })
            }
          }
        } catch { /* skip bad skills.json */ }
      }

      // req-review-agent 内置技能
      const reqAgentDir = path.join(agentsRoot, 'req-review-agent')
      if (!body.agentId || body.agentId === 'req-review-agent' || body.agentId === 'hermione-tech') {
        allSkills.push(
          { id: 'ones_scan_pending', name: '扫描待审批需求', description: '扫描飞书表格并发送审核卡片', agentId: 'req-review-agent', agentName: '需求审核', type: 'script', available: fs.existsSync(path.join(reqAgentDir, 'scan_and_send.py')) },
          { id: 'ones_check_status', name: '检查 ONES 状态', description: '检查待审批/已处理/Token/监听状态', agentId: 'req-review-agent', agentName: '需求审核', type: 'builtin', available: true },
          { id: 'ones_start_listener', name: '启动卡片监听', description: '启动飞书卡片回调服务', agentId: 'req-review-agent', agentName: '需求审核', type: 'script', available: fs.existsSync(path.join(reqAgentDir, 'card_action_handler.py')) },
        )
      }

      sendJson(response, 200, { ok: true, skills: allSkills, total: allSkills.length } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/skills/marketplace' && request.method === 'POST') {
      const body = payload as { query?: string; agentType?: string; tags?: string[] }
      const agentsRoot = path.resolve(dataRoot, 'openclaw_agents')
      const allSkills: Array<Record<string, unknown>> = []

      const agentDirs = fs.readdirSync(agentsRoot, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('_'))

      for (const dir of agentDirs) {
        const skillsPath = path.join(agentsRoot, dir.name, 'skills.json')
        if (!fs.existsSync(skillsPath)) continue
        try {
          const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf-8')) as Array<Record<string, unknown>>
          for (const s of skills) {
            const scriptFile = s.script ? path.join(agentsRoot, dir.name, String(s.script)) : null
            allSkills.push({
              ...s,
              agentId: dir.name,
              installed: scriptFile ? fs.existsSync(scriptFile) : true,
              hasManifest: s.version !== undefined,
            })
          }
        } catch { /* skip */ }
      }

      let filtered = allSkills
      if (body.query) {
        const q = body.query.toLowerCase()
        filtered = filtered.filter(s =>
          String(s.name ?? '').toLowerCase().includes(q) ||
          String(s.description ?? '').toLowerCase().includes(q) ||
          String(s.id ?? '').toLowerCase().includes(q)
        )
      }
      if (body.agentType) {
        filtered = filtered.filter(s => String(s.agentId ?? '').includes(body.agentType!))
      }

      sendJson(response, 200, {
        ok: true,
        skills: filtered.slice(0, 50),
        total: filtered.length,
        allCount: allSkills.length,
      } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/skills/run' && request.method === 'POST') {
      const body = payload as { skillId?: string; agentId?: string; args?: string }
      const skillId = body.skillId ?? ''
      const agentsRoot = path.resolve(dataRoot, 'openclaw_agents')

      // Built-in: ones_check_status
      if (skillId === 'ones_check_status') {
        const reqDir = path.join(agentsRoot, 'req-review-agent')
        const pendingPath = path.join(reqDir, 'memory', 'pending_reviews.json')
        const processedPath = path.join(reqDir, 'memory', 'processed_log.json')
        let pendingCount = 0, processedCount = 0
        try { const d = JSON.parse(fs.readFileSync(pendingPath, 'utf-8')); pendingCount = Array.isArray(d) ? d.length : Object.keys(d).length } catch { /* status endpoint tolerates missing ONES memory files */ }
        try { const d = JSON.parse(fs.readFileSync(processedPath, 'utf-8')); processedCount = Array.isArray(d) ? d.length : 0 } catch { /* status endpoint tolerates missing ONES memory files */ }

        let tokenStatus = '未知'
        try {
          const cache = JSON.parse(fs.readFileSync(path.join(reqDir, 'token_cache.json'), 'utf-8'))
          if (cache.ones_lt) {
            const decoded = JSON.parse(Buffer.from(cache.ones_lt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
            tokenStatus = (decoded.exp ?? 0) * 1000 > Date.now() ? '有效' : '已过期'
          }
        } catch { /* token cache is optional for local status checks */ }

        sendJson(response, 200, { ok: true, result: { summary: `待审批: ${pendingCount} | 已处理: ${processedCount} | Token: ${tokenStatus}`, pending_reviews: pendingCount, processed_log: processedCount, token_status: tokenStatus } } as unknown as JsonRecord)
        return
      }

      // Built-in: ones_scan_pending / ones_start_listener
      if (skillId === 'ones_scan_pending' || skillId === 'ones_start_listener') {
        const reqDir = path.join(agentsRoot, 'req-review-agent')
        const scriptName = skillId === 'ones_scan_pending' ? 'scan_and_send.py' : 'card_action_handler.py'
        const scriptPath = path.join(reqDir, scriptName)
        if (!fs.existsSync(scriptPath)) { sendJson(response, 404, { ok: false, error: `脚本不存在: ${scriptPath}` }); return }

        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
        if (skillId === 'ones_start_listener') {
          const c = spawn(pythonCmd, [scriptPath], { cwd: reqDir, detached: true, stdio: 'ignore', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, windowsHide: true })
          c.unref()
          sendJson(response, 200, { ok: true, result: { message: `卡片监听已启动 (PID: ${c.pid})`, pid: c.pid } } as unknown as JsonRecord)
          return
        }
        const c = spawn(pythonCmd, [scriptPath], { cwd: reqDir, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONLEGACYWINDOWSSTDIO: '0' }, timeout: 120000, windowsHide: true })
        let sout = '', serr = ''
        c.stdout?.on('data', (d: Buffer) => { sout += d.toString('utf-8') })
        c.stderr?.on('data', (d: Buffer) => { serr += d.toString('utf-8') })
        c.on('close', (code) => {
          const output = (sout + '\n' + serr).trim()
          let parsed: unknown = null
          try { const jl = output.split('\n').filter(l => l.trim().startsWith('{')); if (jl.length) parsed = JSON.parse(jl[jl.length - 1]) } catch { /* Python skills may emit non-JSON logs */ }
          sendJson(response, 200, { ok: code === 0, result: { exitCode: code, output: output.slice(-2000), parsed, message: code === 0 ? '执行成功' : `失败 (${code})`, summary: (parsed as Record<string, string>)?.summary ?? (code === 0 ? '扫描完成' : '执行失败') } } as unknown as JsonRecord)
        })
        c.on('error', (err) => { sendJson(response, 200, { ok: false, result: { message: `启动失败: ${err.message}` } } as unknown as JsonRecord) })
        return
      }

      // 通用技能执行：从 agent 的 skills.json 查找并执行
      let foundAgent = body.agentId ?? ''
      let foundScript = ''
      let foundTimeout = 60
      let foundType = ''

      const searchAgentSkills = (agentName: string): boolean => {
        const sp = path.join(agentsRoot, agentName, 'skills.json')
        if (!fs.existsSync(sp)) return false
        try {
          const skills = JSON.parse(fs.readFileSync(sp, 'utf-8')) as { id: string; script?: string; timeout?: number; type?: string }[]
          const match = skills.find(s => s.id === skillId)
          if (match) { foundAgent = agentName; foundScript = match.script ?? ''; foundTimeout = match.timeout ?? 60; foundType = match.type ?? 'script'; return true }
        } catch { /* malformed skill manifests are ignored during discovery */ }
        return false
      }

      if (foundAgent) searchAgentSkills(foundAgent)

      if (!foundScript) {
        for (const entry of fs.readdirSync(agentsRoot, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          if (searchAgentSkills(entry.name)) break
        }
      }

      if (!foundAgent) { sendJson(response, 200, { ok: false, result: { message: `未找到技能: ${skillId}`, summary: `未找到技能: ${skillId}` } } as unknown as JsonRecord); return }

      if (foundType === 'llm_to_file') {
        sendJson(response, 200, { ok: true, result: { message: `LLM 技能 [${skillId}] 需由前端 LLM 引擎执行`, summary: `LLM 技能 [${skillId}] 已标记，待前端执行`, type: 'llm_to_file', agentId: foundAgent } } as unknown as JsonRecord)
        return
      }

      if (!foundScript) { sendJson(response, 200, { ok: false, result: { message: `技能 ${skillId} 无可执行脚本`, summary: `技能 ${skillId} 无脚本` } } as unknown as JsonRecord); return }

      const agentDir = path.join(agentsRoot, foundAgent)
      const scriptPath = path.join(agentDir, foundScript)
        if (!fs.existsSync(scriptPath)) { sendJson(response, 200, { ok: false, result: { message: `脚本不存在: ${foundScript}`, summary: `脚本 ${foundScript} 不存在` } } as unknown as JsonRecord); return }

      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      const args = body.args ? [scriptPath, body.args] : [scriptPath]
      const child = spawn(pythonCmd, args, { cwd: agentDir, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONLEGACYWINDOWSSTDIO: '0' }, timeout: foundTimeout * 1000, windowsHide: true })

      let stdout = '', stderr = ''
      child.stdout?.on('data', (d: Buffer) => { stdout += d.toString('utf-8') })
      child.stderr?.on('data', (d: Buffer) => { stderr += d.toString('utf-8') })

      child.on('close', (code, signal) => {
        const output = (stdout + '\n' + stderr).trim()
        let parsed: Record<string, unknown> | null = null
        try { const jl = output.split('\n').filter(l => l.trim().startsWith('{')); if (jl.length) parsed = JSON.parse(jl[jl.length - 1]) as Record<string, unknown> } catch { /* Python skills may emit non-JSON logs */ }
        let summary: string
        if (code === null && signal) {
          summary = `执行超时被终止 (signal: ${signal}, timeout: ${foundTimeout}s)`
        } else if (code === null) {
          summary = `执行异常退出 (timeout: ${foundTimeout}s, 可能LLM响应过慢)`
        } else {
          summary = (parsed?.summary as string) ?? (code === 0 ? '执行成功' : `执行失败 (exit ${code})`)
        }
        sendJson(response, 200, { ok: parsed?.ok ?? (code === 0), result: { exitCode: code, output: output.slice(-2000), parsed, message: summary, summary, agentId: foundAgent } } as unknown as JsonRecord)
      })
      child.on('error', (err) => { sendJson(response, 200, { ok: false, result: { message: `启动失败: ${err.message}`, agentId: foundAgent } } as unknown as JsonRecord) })
      return
    }

    if (request.url === '/api/openclaw/skills' && request.method === 'POST') {
      const skillDirs = [
        path.resolve(dataRoot, 'skills'),
        path.resolve(dataRoot, 'openclaw_skills'),
      ]
      const skills: { name: string; description: string; source: string }[] = []

      for (const dir of skillDirs) {
        if (!fs.existsSync(dir)) continue
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          const skillPath = path.join(dir, entry.name, 'SKILL.md')
          if (!fs.existsSync(skillPath)) continue
          try {
            const content = fs.readFileSync(skillPath, 'utf-8')
            const nameMatch = content.match(/^name:\s*(.+)$/m)
            const descMatch = content.match(/^description:\s*"?(.+?)"?\s*$/m)
            skills.push({
              name: nameMatch?.[1]?.trim() ?? entry.name,
              description: descMatch?.[1]?.trim() ?? '',
              source: path.basename(dir),
            })
          } catch { /* skip */ }
        }
      }

      sendJson(response, 200, { ok: true, skills } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/company/heartbeat' && request.method === 'POST') {
      sendJson(response, 200, { ok: true, triggered: true })
      return
    }

    // ─── CEO 聊天增强：文件上传 ───

    if (request.url === '/api/chat/upload' && request.method === 'POST') {
      const body = payload as { fileName?: string; mimeType?: string; dataBase64?: string }
      if (!body.fileName || !body.dataBase64) {
        sendJson(response, 400, { ok: false, error: 'fileName and dataBase64 required' })
        return
      }
      const uploadsDir = path.resolve(projectRoot, 'uploads')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

      const safeName = `${Date.now()}_${body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const filePath = path.join(uploadsDir, safeName)
      const buf = Buffer.from(body.dataBase64, 'base64')
      fs.writeFileSync(filePath, buf)

      let textContent = ''
      const ext = path.extname(body.fileName).toLowerCase()
      if (['.txt', '.md', '.json', '.csv', '.ts', '.tsx', '.js', '.jsx', '.py', '.html', '.css', '.yaml', '.yml', '.toml', '.xml', '.sql', '.sh', '.ps1', '.bat'].includes(ext)) {
        try { textContent = buf.toString('utf-8').slice(0, 8000) } catch { /* binary */ }
      }

      sendJson(response, 200, {
        ok: true,
        file: {
          id: `upload_${Date.now()}`,
          name: body.fileName,
          mimeType: body.mimeType ?? 'application/octet-stream',
          size: buf.length,
          path: safeName,
          textContent,
        },
      } as unknown as JsonRecord)
      return
    }

    // ─── CEO 聊天增强：项目文件搜索 ───

    if (request.url === '/api/chat/search-files' && request.method === 'POST') {
      const body = payload as { query?: string; limit?: number }
      const query = (body.query ?? '').toLowerCase().trim()
      if (!query) { sendJson(response, 400, { ok: false, error: 'query required' }); return }

      const rootDir = dataRoot
      const results: { name: string; relativePath: string; size: number; ext: string; preview: string }[] = []
      const limit = Math.min(body.limit ?? 20, 50)

      const scanDirs = ['openclaw_agents', 'skills', 'openclaw_skills', 'config', 'docs', 'scripts', 'data_raw', 'data_clean', 'output']
      const textExts = new Set(['.md', '.txt', '.json', '.ts', '.tsx', '.js', '.jsx', '.py', '.css', '.html', '.yaml', '.yml', '.toml', '.xml', '.sql', '.sh', '.ps1', '.bat', '.csv'])

      function walk(dir: string, rel: string) {
        if (results.length >= limit) return
        let entries: fs.Dirent[]
        try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
        for (const entry of entries) {
          if (results.length >= limit) return
          const fullPath = path.join(dir, entry.name)
          const relPath = rel ? `${rel}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            if (['node_modules', '.git', '__pycache__', '.venv', 'dist', '.cursor'].includes(entry.name)) continue
            walk(fullPath, relPath)
          } else if (entry.isFile()) {
            const nameMatch = entry.name.toLowerCase().includes(query)
            let contentMatch = false
            let preview = ''
            const ext = path.extname(entry.name).toLowerCase()

            if (textExts.has(ext)) {
              try {
                const content = fs.readFileSync(fullPath, 'utf-8')
                const idx = content.toLowerCase().indexOf(query)
                if (idx >= 0) {
                  contentMatch = true
                  const start = Math.max(0, idx - 60)
                  const end = Math.min(content.length, idx + query.length + 60)
                  preview = (start > 0 ? '...' : '') + content.slice(start, end).replace(/\n/g, ' ') + (end < content.length ? '...' : '')
                } else if (nameMatch) {
                  preview = content.slice(0, 120).replace(/\n/g, ' ')
                }
              } catch { /* unreadable */ }
            }

            if (nameMatch || contentMatch) {
              let size = 0
              try { size = fs.statSync(fullPath).size } catch { /* ok */ }
              results.push({ name: entry.name, relativePath: relPath, size, ext, preview })
            }
          }
        }
      }

      for (const d of scanDirs) {
        const dir = path.join(rootDir, d)
        if (fs.existsSync(dir)) walk(dir, d)
      }

      sendJson(response, 200, { ok: true, results } as unknown as JsonRecord)
      return
    }

    // ─── CEO 聊天增强：读取项目文件内容（用于引用） ───

    if (request.url === '/api/chat/read-file' && request.method === 'POST') {
      const body = payload as { relativePath?: string; startLine?: number; endLine?: number }
      if (!body.relativePath) { sendJson(response, 400, { ok: false, error: 'relativePath required' }); return }

      const rootDir = dataRoot
      const filePath = path.resolve(rootDir, body.relativePath)
      if (!filePath.startsWith(rootDir)) { sendJson(response, 403, { ok: false, error: 'Access denied' }); return }
      if (!fs.existsSync(filePath)) { sendJson(response, 404, { ok: false, error: 'File not found' }); return }

      const stat = fs.statSync(filePath)
      if (stat.size > 500000) { sendJson(response, 413, { ok: false, error: 'File too large (max 500KB)' }); return }

      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      const start = Math.max(0, (body.startLine ?? 1) - 1)
      const end = Math.min(lines.length, body.endLine ?? lines.length)
      const sliced = lines.slice(start, end).join('\n')

      sendJson(response, 200, {
        ok: true,
        content: sliced.slice(0, 8000),
        totalLines: lines.length,
        fileName: path.basename(filePath),
      } as unknown as JsonRecord)
      return
    }

    // ─── CEO 聊天增强：URL 内容抓取 ───

    if (request.url === '/api/chat/fetch-url' && request.method === 'POST') {
      const body = payload as { url?: string }
      if (!body.url) { sendJson(response, 400, { ok: false, error: 'url required' }); return }

      try {
        const targetUrl = new URL(body.url)
        const isHttps = targetUrl.protocol === 'https:'
        const fetchFn = isHttps ? httpsRequest : httpRequest

        const result = await new Promise<{ title: string; summary: string }>((resolve, reject) => {
          const isFetchLocal = targetUrl.hostname === '127.0.0.1' || targetUrl.hostname === 'localhost'
          const req = fetchFn({
            hostname: targetUrl.hostname,
            port: targetUrl.port || (isHttps ? 443 : 80),
            path: targetUrl.pathname + targetUrl.search,
            method: 'GET',
            timeout: 10000,
            headers: { 'User-Agent': 'JarvisBot/1.0' },
            ...(!isFetchLocal && OUTBOUND_LOCAL_ADDRESS ? { localAddress: OUTBOUND_LOCAL_ADDRESS } : {}),
          }, (res) => {
            let html = ''
            res.setEncoding('utf-8')
            res.on('data', (chunk: string) => { html += chunk; if (html.length > 50000) res.destroy() })
            res.on('end', () => {
              const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
              const title = titleMatch?.[1]?.trim() ?? targetUrl.hostname

              const textContent = html
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
              const summary = textContent.slice(0, 300)
              resolve({ title, summary })
            })
          })
          req.on('error', reject)
          req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
          req.end()
        })

        sendJson(response, 200, { ok: true, ...result } as unknown as JsonRecord)
      } catch {
        sendJson(response, 200, { ok: false, title: body.url, summary: '无法获取页面内容' } as unknown as JsonRecord)
      }
      return
    }

    if (request.url === '/api/openclaw/status') {
      const configPath = path.resolve(projectRoot, 'config', 'openclaw-agents.json')
      let openclawBase = 'http://127.0.0.1:18789'
      try {
        const agentsConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { openclawApiBase?: string }
        openclawBase = agentsConfig.openclawApiBase ?? openclawBase
      } catch { /* use default */ }

      const healthUrl = new URL(`${openclawBase}/health`)
      const isHealthHttps = healthUrl.protocol === 'https:'
      const healthReqFn = isHealthHttps ? httpsRequest : httpRequest

      let healthReplied = false
      const hReq = healthReqFn({
        hostname: healthUrl.hostname,
        port: healthUrl.port || (isHealthHttps ? 443 : 80),
        path: healthUrl.pathname,
        method: 'GET',
        timeout: 5000,
      }, (res) => {
        let body = ''
        res.on('data', (c: Buffer) => { body += c.toString() })
        res.on('end', () => {
          if (healthReplied) return
          healthReplied = true
          sendJson(response, 200, { ok: true, openclawRunning: true, raw: body })
        })
      })
      hReq.on('error', () => {
        if (healthReplied) return
        healthReplied = true
        sendJson(response, 200, { ok: true, openclawRunning: false })
      })
      hReq.on('timeout', () => {
        hReq.destroy()
        if (healthReplied) return
        healthReplied = true
        sendJson(response, 200, { ok: true, openclawRunning: false })
      })
      hReq.end()
      return
    }

    // ─── Chat Persistence API ───

    if (request.url === '/api/chat/topics') {
      const topics = await prisma.chatTopic.findMany({ orderBy: { updatedAt: 'desc' } })
      sendJson(response, 200, { ok: true, topics } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/chat/topic/create') {
      const body = payload as Record<string, unknown>
      const title = String(body.title ?? '新对话')
      const id = `topic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const topic = await prisma.chatTopic.create({ data: { id, title } })
      sendJson(response, 200, { ok: true, topic } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/chat/topic/rename') {
      const body = payload as Record<string, unknown>
      const id = String(body.id ?? '')
      const title = String(body.title ?? '')
      if (!id || !title) { sendJson(response, 400, { ok: false, error: 'Missing id or title' }); return }
      await prisma.chatTopic.update({ where: { id }, data: { title } })
      sendJson(response, 200, { ok: true })
      return
    }

    if (request.url === '/api/chat/topic/delete') {
      const body = payload as Record<string, unknown>
      const id = String(body.id ?? '')
      if (!id) { sendJson(response, 400, { ok: false, error: 'Missing id' }); return }
      await prisma.chatTopic.delete({ where: { id } })
      sendJson(response, 200, { ok: true })
      return
    }

    if (request.url === '/api/chat/messages') {
      const body = payload as Record<string, unknown>
      const topicId = String(body.topicId ?? '')
      if (!topicId) { sendJson(response, 400, { ok: false, error: 'Missing topicId' }); return }
      const rows = await prisma.chatMessage.findMany({
        where: { topicId },
        orderBy: { createdAt: 'asc' },
        take: 200,
      })
      const messages = rows.map(r => ({
        id: r.id,
        role: r.role,
        content: r.content,
        attachments: r.attachmentsJson ? JSON.parse(r.attachmentsJson) : undefined,
        mentions: r.mentionsJson ? JSON.parse(r.mentionsJson) : undefined,
        quotedMessage: r.quotedMessageJson ? JSON.parse(r.quotedMessageJson) : undefined,
        teamMessages: r.teamMessagesJson ? JSON.parse(r.teamMessagesJson) : undefined,
        llmModelUsed: r.llmModelUsed ?? undefined,
        createdAt: r.createdAt.toISOString().slice(0, 16).replace('T', ' '),
      }))
      sendJson(response, 200, { ok: true, messages } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/chat/message/append') {
      const body = payload as Record<string, unknown>
      const topicId = String(body.topicId ?? '')
      const msg = body.message as Record<string, unknown> | undefined
      if (!topicId || !msg) { sendJson(response, 400, { ok: false, error: 'Missing topicId or message' }); return }

      const id = String(msg.id ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`)
      await prisma.chatMessage.create({
        data: {
          id,
          topicId,
          role: String(msg.role ?? 'ceo'),
          content: String(msg.content ?? ''),
          attachmentsJson: msg.attachments ? JSON.stringify(msg.attachments) : null,
          mentionsJson: msg.mentions ? JSON.stringify(msg.mentions) : null,
          quotedMessageJson: msg.quotedMessage ? JSON.stringify(msg.quotedMessage) : null,
          teamMessagesJson: msg.teamMessages ? JSON.stringify(msg.teamMessages) : null,
          llmModelUsed: msg.llmModelUsed ? String(msg.llmModelUsed) : null,
        },
      })

      const count = await prisma.chatMessage.count({ where: { topicId } })
      const topicUpdate: Record<string, unknown> = { messageCount: count }
      if (msg.role === 'ceo' && count <= 2) {
        const content = String(msg.content ?? '')
        if (content.length > 0) {
          const topic = await prisma.chatTopic.findUnique({ where: { id: topicId } })
          if (topic && topic.title === '新对话') {
            topicUpdate.title = content.slice(0, 30) + (content.length > 30 ? '...' : '')
          }
        }
      }
      await prisma.chatTopic.update({ where: { id: topicId }, data: topicUpdate })

      sendJson(response, 200, { ok: true, messageId: id })
      return
    }

    if (request.url === '/api/chat/messages/clear') {
      const body = payload as Record<string, unknown>
      const topicId = String(body.topicId ?? '')
      if (!topicId) { sendJson(response, 400, { ok: false, error: 'Missing topicId' }); return }
      await prisma.chatMessage.deleteMany({ where: { topicId } })
      await prisma.chatTopic.update({ where: { id: topicId }, data: { messageCount: 0 } })
      sendJson(response, 200, { ok: true })
      return
    }

    if (request.url === '/api/chat/import') {
      const body = payload as { topics?: Array<{ id: string; title: string; createdAt: string; updatedAt: string; messageCount: number; messages: Array<Record<string, unknown>> }> }
      if (!Array.isArray(body.topics)) { sendJson(response, 400, { ok: false, error: 'Missing topics array' }); return }
      let imported = 0
      for (const t of body.topics) {
        const existing = await prisma.chatTopic.findUnique({ where: { id: t.id } })
        if (existing) continue
        await prisma.chatTopic.create({
          data: {
            id: t.id,
            title: t.title,
            messageCount: t.messageCount ?? 0,
            createdAt: new Date(t.createdAt),
          },
        })
        for (const m of (t.messages ?? [])) {
          await prisma.chatMessage.create({
            data: {
              id: String(m.id ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
              topicId: t.id,
              role: String(m.role ?? 'ceo'),
              content: String(m.content ?? ''),
              attachmentsJson: m.attachments ? JSON.stringify(m.attachments) : null,
              mentionsJson: m.mentions ? JSON.stringify(m.mentions) : null,
              quotedMessageJson: m.quotedMessage ? JSON.stringify(m.quotedMessage) : null,
              teamMessagesJson: m.teamMessages ? JSON.stringify(m.teamMessages) : null,
              llmModelUsed: m.llmModelUsed ? String(m.llmModelUsed) : null,
            },
          })
        }
        imported++
      }
      sendJson(response, 200, { ok: true, imported })
      return
    }

    // ─── Memory Service API ───

    if (request.url === '/api/memory/save') {
      const body = payload as Record<string, unknown>
      const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const agentId = String(body.agentId ?? '')
      const category = String(body.category ?? 'learnings')
      const content = String(body.content ?? '')
      const source = String(body.source ?? 'unknown')
      const importance = Number(body.importance ?? 0.8)

      if (!agentId || !content) {
        sendJson(response, 400, { ok: false, error: 'agentId and content required' })
        return
      }

      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO memory_entries (id, agentId, category, content, source, importance, citedCount, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
          id, agentId, category, content, source, importance,
        )

        const agentsRoot = path.resolve(dataRoot, 'openclaw_agents')
        const memDir = path.join(agentsRoot, agentId.replace(/-/g, '_').replace('_', '-'), 'memory')
        if (fs.existsSync(memDir)) {
          const fileMap: Record<string, string> = {
            learnings: 'learnings.md',
            ceo_preferences: 'ceo_preferences.md',
            decisions: 'decisions.md',
          }
          const memFile = fileMap[category] ?? `${category}.md`
          const filePath = path.join(memDir, memFile)
          const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
          const line = `\n- [${timestamp}] ${content}\n`
          fs.appendFileSync(filePath, line, 'utf-8')
        }

        sendJson(response, 200, { ok: true, id } as unknown as JsonRecord)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        sendJson(response, 200, { ok: false, error: msg })
      }
      return
    }

    if (request.url === '/api/memory/search') {
      const body = payload as Record<string, unknown>
      const agentId = String(body.agentId ?? '')
      const query = String(body.query ?? '')
      const category = body.category ? String(body.category) : null
      const limit = Math.min(Number(body.limit ?? 10), 50)

      try {
        const keywords = query.split(/[\s,，。！？]+/).filter(w => w.length >= 2).slice(0, 5)
        let whereClause = 'WHERE agentId = ?'
        const params: unknown[] = [agentId]

        if (category) {
          whereClause += ' AND category = ?'
          params.push(category)
        }

        if (keywords.length > 0) {
          const likeConditions = keywords.map(() => 'content LIKE ?').join(' OR ')
          whereClause += ` AND (${likeConditions})`
          keywords.forEach(k => params.push(`%${k}%`))
        }

        params.push(limit)

        const rows = await prisma.$queryRawUnsafe(
          `SELECT id, agentId, category, content, source, importance, citedCount, createdAt
           FROM memory_entries ${whereClause}
           ORDER BY importance DESC, createdAt DESC
           LIMIT ?`,
          ...params,
        ) as Array<Record<string, unknown>>

        for (const row of rows) {
          await prisma.$executeRawUnsafe(
            `UPDATE memory_entries SET citedCount = citedCount + 1, lastCitedAt = datetime('now') WHERE id = ?`,
            row.id,
          )
        }

        sendJson(response, 200, {
          entries: rows.map(r => ({
            id: r.id,
            agentId: r.agentId,
            category: r.category,
            content: r.content,
            source: r.source,
            importance: Number(r.importance),
            citedCount: Number(r.citedCount),
            createdAt: r.createdAt,
          })),
        } as unknown as JsonRecord)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        sendJson(response, 200, { entries: [], error: msg } as unknown as JsonRecord)
      }
      return
    }

    if (request.url === '/api/memory/list') {
      const body = payload as Record<string, unknown>
      const agentId = String(body.agentId ?? '')
      const category = body.category ? String(body.category) : null
      const limit = Math.min(Number(body.limit ?? 20), 100)

      try {
        let whereClause = 'WHERE agentId = ?'
        const params: unknown[] = [agentId]

        if (category) {
          whereClause += ' AND category = ?'
          params.push(category)
        }
        params.push(limit)

        const rows = await prisma.$queryRawUnsafe(
          `SELECT id, agentId, category, content, source, importance, citedCount, createdAt
           FROM memory_entries ${whereClause}
           ORDER BY importance DESC, createdAt DESC
           LIMIT ?`,
          ...params,
        ) as Array<Record<string, unknown>>

        sendJson(response, 200, {
          entries: rows.map(r => ({
            id: r.id,
            agentId: r.agentId,
            category: r.category,
            content: r.content,
            source: r.source,
            importance: Number(r.importance),
            citedCount: Number(r.citedCount),
            createdAt: r.createdAt,
          })),
        } as unknown as JsonRecord)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        sendJson(response, 200, { entries: [], error: msg } as unknown as JsonRecord)
      }
      return
    }

    if (request.url === '/api/memory/decay') {
      try {
        const decayRate = 0.98
        await prisma.$executeRawUnsafe(
          `UPDATE memory_entries SET importance = importance * ?, updatedAt = datetime('now')
           WHERE importance > 0.1`,
          decayRate,
        )
        await prisma.$executeRawUnsafe(
          `DELETE FROM memory_entries WHERE importance < 0.05 AND citedCount = 0
           AND createdAt < datetime('now', '-30 days')`,
        )
        const remaining = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as cnt FROM memory_entries`,
        ) as Array<{ cnt: number }>
        sendJson(response, 200, { ok: true, remaining: Number(remaining[0]?.cnt ?? 0) } as unknown as JsonRecord)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        sendJson(response, 200, { ok: false, error: msg })
      }
      return
    }

    // ─── LLM Usage Tracking ───

    if (request.url === '/api/llm/usage-log') {
      const body = payload as Record<string, unknown>
      const id = `llm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO llm_usage_logs (id, agentId, taskId, provider, model, inputTokens, outputTokens, totalTokens, estimatedCost, callerFunction, durationMs, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          id,
          body.agentId ?? null,
          body.taskId ?? null,
          String(body.provider ?? ''),
          String(body.model ?? ''),
          Number(body.inputTokens ?? 0),
          Number(body.outputTokens ?? 0),
          Number(body.totalTokens ?? 0),
          Number(body.estimatedCost ?? 0),
          String(body.callerFunction ?? ''),
          Number(body.durationMs ?? 0),
        )
        sendJson(response, 200, { ok: true, id } as unknown as JsonRecord)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[LLM Usage Log] write error:', msg)
        sendJson(response, 200, { ok: false, error: msg })
      }
      return
    }

    if (request.url === '/api/llm/usage-stats') {
      try {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const todayRows = await prisma.$queryRawUnsafe(
          `SELECT COALESCE(SUM(totalTokens),0) as tokens, COALESCE(SUM(estimatedCost),0) as cost, COUNT(*) as calls
           FROM llm_usage_logs WHERE createdAt >= ?`, todayStart
        ) as Array<{ tokens: number; cost: number; calls: number }>

        const weekRows = await prisma.$queryRawUnsafe(
          `SELECT COALESCE(SUM(totalTokens),0) as tokens, COALESCE(SUM(estimatedCost),0) as cost, COUNT(*) as calls
           FROM llm_usage_logs WHERE createdAt >= ?`, weekAgo
        ) as Array<{ tokens: number; cost: number; calls: number }>

        const byAgent = await prisma.$queryRawUnsafe(
          `SELECT agentId, SUM(totalTokens) as tokens, SUM(estimatedCost) as cost, COUNT(*) as calls
           FROM llm_usage_logs WHERE createdAt >= ? GROUP BY agentId ORDER BY cost DESC LIMIT 20`, weekAgo
        ) as Array<{ agentId: string | null; tokens: number; cost: number; calls: number }>

        const recentLogs = await prisma.$queryRawUnsafe(
          `SELECT id, agentId, provider, model, inputTokens, outputTokens, totalTokens, estimatedCost, callerFunction, durationMs, createdAt
           FROM llm_usage_logs ORDER BY createdAt DESC LIMIT 30`
        ) as Array<Record<string, unknown>>

        const today = todayRows[0] ?? { tokens: 0, cost: 0, calls: 0 }
        const week = weekRows[0] ?? { tokens: 0, cost: 0, calls: 0 }

        sendJson(response, 200, {
          todayCost: Number(today.cost),
          todayTokens: Number(today.tokens),
          todayCalls: Number(today.calls),
          weeklyCost: Number(week.cost),
          weeklyTokens: Number(week.tokens),
          weeklyCalls: Number(week.calls),
          costByAgent: byAgent.map(r => ({
            agentId: r.agentId ?? 'unknown',
            agentName: r.agentId ?? 'unknown',
            totalTokens: Number(r.tokens),
            estimatedCost: Number(r.cost),
            callCount: Number(r.calls),
          })),
          recentLogs: recentLogs.map(r => ({
            id: r.id,
            agentId: r.agentId,
            provider: r.provider,
            model: r.model,
            inputTokens: Number(r.inputTokens),
            outputTokens: Number(r.outputTokens),
            totalTokens: Number(r.totalTokens),
            estimatedCost: Number(r.estimatedCost),
            callerFunction: r.callerFunction,
            durationMs: Number(r.durationMs),
            createdAt: r.createdAt,
          })),
        } as unknown as JsonRecord)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[LLM Usage Stats] query error:', msg)
        sendJson(response, 200, {
          todayCost: 0, todayTokens: 0, todayCalls: 0,
          weeklyCost: 0, weeklyTokens: 0, weeklyCalls: 0,
          costByAgent: [], recentLogs: [],
        } as unknown as JsonRecord)
      }
      return
    }

    // ─── Webhook Management API ───

    if (request.url === '/api/webhooks/list') {
      const configPath = path.resolve(dataRoot, 'config', 'webhook-config.json')
      let config = { webhooks: [] as Array<Record<string, unknown>>, events: [] as string[] }
      if (fs.existsSync(configPath)) {
        try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) } catch { /* use default */ }
      }
      sendJson(response, 200, config as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/webhooks/register') {
      const body = payload as { url?: string; events?: string[]; secret?: string }
      if (!body.url) { sendJson(response, 400, { ok: false, error: 'url required' }); return }

      const configPath = path.resolve(dataRoot, 'config', 'webhook-config.json')
      let config: { webhooks: Array<Record<string, unknown>>; events: string[] } = { webhooks: [], events: [] }
      if (fs.existsSync(configPath)) {
        try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) } catch { /* use default */ }
      }

      const webhook = {
        id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        url: body.url,
        secret: body.secret ?? '',
        events: body.events ?? ['*'],
        enabled: true,
        retryMax: 3,
        createdAt: new Date().toISOString(),
      }
      config.webhooks.push(webhook)
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
      sendJson(response, 200, { ok: true, webhook } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/webhooks/test') {
      const body = payload as { webhookId?: string; event?: string }
      const configPath = path.resolve(dataRoot, 'config', 'webhook-config.json')
      let config: { webhooks: Array<Record<string, unknown>> } = { webhooks: [] }
      if (fs.existsSync(configPath)) {
        try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) } catch { /* */ }
      }
      const wh = config.webhooks.find(w => w.id === body.webhookId)
      if (!wh) { sendJson(response, 404, { ok: false, error: 'Webhook not found' }); return }

      const testPayload = {
        id: `evt_test_${Date.now()}`,
        event: body.event ?? 'test.ping',
        timestamp: new Date().toISOString(),
        data: { message: 'Webhook test from Jarvis OS' },
      }

      try {
        const targetUrl = new URL(String(wh.url))
        const isHttps = targetUrl.protocol === 'https:'
        const reqFn = isHttps ? httpsRequest : httpRequest
        const postBody = JSON.stringify(testPayload)

        await new Promise<void>((resolve, reject) => {
          const req = reqFn({
            hostname: targetUrl.hostname,
            port: targetUrl.port || (isHttps ? 443 : 80),
            path: targetUrl.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postBody) },
            timeout: 10000,
          }, (res) => {
            res.resume()
            res.on('end', () => resolve())
          })
          req.on('error', reject)
          req.write(postBody)
          req.end()
        })
        sendJson(response, 200, { ok: true, sent: testPayload } as unknown as JsonRecord)
      } catch (err) {
        sendJson(response, 200, { ok: false, error: String(err) })
      }
      return
    }

    // ─── Public REST API (External) — Bearer Token Auth ───

    if (request.url?.startsWith('/api/v1/')) {
      const apiToken = process.env.JARVIS_API_TOKEN
      if (apiToken) {
        const authHeader = request.headers['authorization'] ?? ''
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
        if (token !== apiToken) {
          sendJson(response, 401, { ok: false, error: 'Unauthorized: invalid or missing Bearer token' })
          return
        }
      }
    }

    if (request.url === '/api/v1/status') {
      const agents = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM agents') as Array<{ cnt: number }>
      const tasks = await prisma.$queryRawUnsafe('SELECT COUNT(*) as total, SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active FROM tasks') as Array<{ total: number; active: number }>
      sendJson(response, 200, {
        ok: true,
        version: '0.1.0',
        agents: Number(agents[0]?.cnt ?? 0),
        totalTasks: Number(tasks[0]?.total ?? 0),
        activeTasks: Number(tasks[0]?.active ?? 0),
        uptime: process.uptime(),
      } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/v1/agents') {
      const agents = await prisma.$queryRawUnsafe('SELECT id, name, role, status, emoji FROM agents ORDER BY name') as Array<Record<string, unknown>>
      sendJson(response, 200, { ok: true, agents } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/v1/tasks') {
      const body = payload as { status?: string; limit?: number }
      const limit = Math.min(Number(body.limit ?? 20), 100)
      let query = 'SELECT id, title, status, taskType, ownerAgentId, priority, createdAt FROM tasks'
      const params: unknown[] = []
      if (body.status) {
        query += ' WHERE status = ?'
        params.push(body.status)
      }
      query += ' ORDER BY createdAt DESC LIMIT ?'
      params.push(limit)
      const tasks = await prisma.$queryRawUnsafe(query, ...params) as Array<Record<string, unknown>>
      sendJson(response, 200, { ok: true, tasks } as unknown as JsonRecord)
      return
    }

    sendJson(response, 404, { ok: false, error: 'Not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    sendJson(response, 500, { ok: false, error: message })
  }
})

type LlmProvider = {
  name: string
  baseUrl: string
  apiKey: string
  modelOverride?: string
  fallbackTo?: string[]
}

function parseModelList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(',').map(item => item.trim()).filter(Boolean)
}

function parseProviderFallbackMap(raw: string | undefined): Record<string, string[]> {
  if (!raw) return {}

  return raw
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string[]>>((acc, item) => {
      const parts = item.split('=')
      if (parts.length < 2) return acc
      const providerName = parts[0]?.trim()
      const fallbackNames = parts.slice(1).join('=').split(',').map(name => name.trim()).filter(Boolean)
      if (providerName && fallbackNames.length > 0) {
        acc[providerName] = fallbackNames
      }
      return acc
    }, {})
}

function serializeProviderFallbackMap(map: Record<string, string[]>): string {
  return Object.entries(map)
    .map(([provider, fallbackNames]) => {
      const cleanProvider = provider.trim()
      const cleanFallbacks = fallbackNames.map(name => name.trim()).filter(Boolean)
      return cleanProvider && cleanFallbacks.length > 0 ? `${cleanProvider}=${cleanFallbacks.join(',')}` : ''
    })
    .filter(Boolean)
    .join(';')
}

function syncLlmConfigToEnv(cfg: JsonRecord): void {
  const envFilePath = path.resolve(projectRoot, '.env')
  const llm = cfg.llm as { providers?: AppConfigLlmProvider[]; default_provider?: string; default_model?: string; fallback_chains?: Record<string, string[]> } | undefined
  if (!llm?.providers) return

  for (const p of llm.providers) {
    if (!p.enabled) continue

    if (p.type === 'relay') {
      if (p.api_key) updateDotEnvValue(envFilePath, 'OPENAI_API_KEY', p.api_key)
      if (p.base_url) updateDotEnvValue(envFilePath, 'OPENAI_BASE_URL', p.base_url)
      const modelNames = p.models.map(m => m.name).filter(Boolean)
      if (modelNames.length > 0) updateDotEnvValue(envFilePath, 'OPENAI_COMPAT_MODELS', modelNames.join(','))
      const defaultModel = p.models.find(m => m.is_default)?.name ?? modelNames[0]
      if (defaultModel) updateDotEnvValue(envFilePath, 'OPENAI_MODEL', defaultModel)
    }

    if (p.type === 'cliproxy') {
      if (p.port) updateDotEnvValue(envFilePath, 'CLIPROXY_PORT', String(p.port))
      if (p.api_key) updateDotEnvValue(envFilePath, 'CLIPROXY_API_KEY', p.api_key)
      const modelNames = p.models.map(m => m.name).filter(Boolean)
      if (modelNames.length > 0) updateDotEnvValue(envFilePath, 'CLIPROXY_MODELS', modelNames.join(','))
    }

    if (p.id === 'openai-direct' && p.type === 'official') {
      if (p.api_key) updateDotEnvValue(envFilePath, 'OPENAI_DIRECT_KEY', p.api_key)
      if (p.base_url) updateDotEnvValue(envFilePath, 'OPENAI_DIRECT_BASE', p.base_url)
      const modelNames = p.models.map(m => m.name).filter(Boolean)
      if (modelNames.length > 0) updateDotEnvValue(envFilePath, 'OPENAI_DIRECT_MODELS', modelNames.join(','))
    }

    if (p.id === 'deepseek' && p.api_key) updateDotEnvValue(envFilePath, 'DEEPSEEK_API_KEY', p.api_key)
    if (p.id === 'moonshot' && p.api_key) updateDotEnvValue(envFilePath, 'MOONSHOT_API_KEY', p.api_key)
    if (p.id === 'siliconflow' && p.api_key) updateDotEnvValue(envFilePath, 'SILICONFLOW_API_KEY', p.api_key)
  }

  if (llm.default_provider) {
    updateDotEnvValue(envFilePath, 'VITE_LLM_DEFAULT_PROVIDER', llm.default_provider)
    process.env.VITE_LLM_DEFAULT_PROVIDER = llm.default_provider
  }
  if (llm.default_model) {
    updateDotEnvValue(envFilePath, 'VITE_LLM_MODEL', llm.default_model)
  }

  if (llm.fallback_chains) {
    const serialized = serializeProviderFallbackMap(llm.fallback_chains)
    updateDotEnvValue(envFilePath, 'LLM_PROVIDER_FALLBACKS', serialized)
    process.env.LLM_PROVIDER_FALLBACKS = serialized
  }

  dotenv.config({ path: envFilePath, override: true })
}

function updateDotEnvValue(filePath: string, key: string, value: string) {
  const escapedValue = `"${value.replace(/"/g, '\\"')}"`
  const line = `${key}=${escapedValue}`
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : ''
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  const next = pattern.test(existing)
    ? existing.replace(pattern, line)
    : `${existing.trimEnd()}${existing.trimEnd() ? '\n' : ''}${line}\n`
  fs.writeFileSync(filePath, next, 'utf-8')
}

function sanitizeModelId(model: string): string {
  return model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'model'
}

function getHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return rawUrl.toLowerCase()
  }
}

function isOfficialOpenAIBase(rawUrl: string): boolean {
  return getHostname(rawUrl) === 'api.openai.com'
}

function isFandaiBase(rawUrl: string): boolean {
  return /(^|\.)sxzhong10667\.eu\.cc$/i.test(getHostname(rawUrl)) || /sxzhong10667\.eu\.cc/i.test(rawUrl)
}

type AppConfigLlmProvider = {
  id: string
  type: 'official' | 'cliproxy' | 'relay'
  name: string
  enabled: boolean
  base_url?: string
  api_key?: string
  port?: number
  models: { id: string; name: string; alias?: string; is_default?: boolean }[]
}

type AppConfigLlm = {
  providers?: AppConfigLlmProvider[]
  fallback_chains?: Record<string, string[]>
}

function loadAppConfigLlm(): AppConfigLlm | null {
  const configPath = path.resolve(dataRoot, 'config', 'app-config.json')
  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { llm?: AppConfigLlm }
      return raw.llm ?? null
    }
  } catch { /* fall through */ }
  return null
}

function buildLlmProviderChainFromConfig(appLlm: AppConfigLlm): LlmProvider[] {
  const chain: LlmProvider[] = []
  const fallbackChains = appLlm.fallback_chains ?? {}

  for (const p of (appLlm.providers ?? [])) {
    if (!p.enabled) continue

    if (p.type === 'cliproxy') {
      const port = p.port ?? 18800
      const apiKey = (p.api_key ?? '').trim()
      for (const m of p.models) {
        chain.push({
          name: m.id,
          baseUrl: `http://127.0.0.1:${port}/v1`,
          apiKey,
          modelOverride: m.name,
          fallbackTo: fallbackChains[m.id],
        })
      }
    } else {
      const baseUrl = (p.base_url ?? '').trim()
      const apiKey = (p.api_key ?? '').trim()
      if (!baseUrl && p.type !== 'official') continue

      for (const m of p.models) {
        chain.push({
          name: m.id,
          baseUrl: baseUrl || 'https://api.openai.com/v1',
          apiKey,
          modelOverride: m.name,
          fallbackTo: fallbackChains[m.id],
        })
      }
    }
  }
  return chain
}

function buildLlmProviderChain(): LlmProvider[] {
  const appLlm = loadAppConfigLlm()
  if (appLlm?.providers && appLlm.providers.length > 0) {
    const configChain = buildLlmProviderChainFromConfig(appLlm)
    if (configChain.length > 0) return configChain
  }

  const chain: LlmProvider[] = []

  const openaiKey = (process.env.OPENAI_API_KEY ?? '').trim()
  const deepseekKey = (process.env.DEEPSEEK_API_KEY ?? '').trim()
  const moonshotKey = (process.env.MOONSHOT_API_KEY ?? '').trim()
  const siliconflowKey = (process.env.SILICONFLOW_API_KEY ?? '').trim()
  const explicitBase = (process.env.LLM_API_BASE ?? '').trim()
  const explicitKey = (process.env.LLM_API_KEY ?? '').trim()
  const openaiBase = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').trim()
  const openaiModel = (process.env.OPENAI_MODEL ?? 'gpt-4o').trim() || 'gpt-4o'
  const openaiCompatModels = parseModelList(process.env.OPENAI_COMPAT_MODELS)
  const providerFallbackMap = parseProviderFallbackMap(process.env.LLM_PROVIDER_FALLBACKS)

  if (explicitBase && explicitBase !== 'http://localhost:11434/v1') {
    chain.push({
      name: 'configured',
      baseUrl: explicitBase,
      apiKey: explicitKey || openaiKey,
    })
  }

  const cliproxyPort = (process.env.CLIPROXY_PORT ?? '').trim()
  const cliproxyKey = (process.env.CLIPROXY_API_KEY ?? '').trim()
  const cliproxyModelsRaw = (process.env.CLIPROXY_MODELS ?? '').trim()
  if (cliproxyPort && cliproxyModelsRaw) {
    const cliproxyModels = cliproxyModelsRaw.split(',').map(m => m.trim()).filter(Boolean)
    for (const modelName of cliproxyModels) {
      const providerId = `chatgpt-plus-${sanitizeModelId(modelName)}`
      chain.push({
        name: providerId,
        baseUrl: `http://127.0.0.1:${cliproxyPort}/v1`,
        apiKey: cliproxyKey,
        modelOverride: modelName,
        fallbackTo: providerFallbackMap[providerId] ?? ['fandai-nn-46', 'fandai-gemini-31', 'fandai-glm-5'],
      })
    }
  }

  if (openaiKey && openaiKey.length > 10) {
    const isFandaiKey = /^(?:sk|k)-fandai/i.test(openaiKey)
    const usesFandaiBase = isFandaiBase(openaiBase)
    const usesOfficialOpenAIBase = isOfficialOpenAIBase(openaiBase)

    if (isFandaiKey || usesFandaiBase) {
      const fandaiBase = openaiBase || 'https://sxzhong10667.eu.cc/v1'
      const fandaiModels = [
        { name: 'fandai-nn-46', model: 'Nshen-NN-4.6', fallbackTo: ['fandai-gemini-31', 'fandai-glm-5'] },
        { name: 'fandai-gemini-31', model: 'Nshen-gemini-3.1', fallbackTo: ['fandai-nn-46', 'fandai-glm-5'] },
        { name: 'fandai-glm-5', model: 'GLM-5', fallbackTo: ['fandai-gemini-31', 'fandai-nn-46'] },
      ]
      for (const fm of fandaiModels) {
        chain.push({
          name: fm.name,
          baseUrl: fandaiBase,
          apiKey: openaiKey,
          modelOverride: fm.model,
          fallbackTo: providerFallbackMap[fm.name] ?? fm.fallbackTo,
        })
      }
    } else {
      const models = openaiCompatModels.length > 0 ? openaiCompatModels : [openaiModel]
      for (const modelName of models) {
        const providerName = usesOfficialOpenAIBase && models.length === 1 && modelName === openaiModel
          ? 'openai'
          : `openai-compat-${sanitizeModelId(modelName)}`
        chain.push({ name: providerName, baseUrl: openaiBase, apiKey: openaiKey, modelOverride: modelName })
      }
    }
  }

  const directKey = (process.env.OPENAI_DIRECT_KEY ?? '').trim()
  const directBase = (process.env.OPENAI_DIRECT_BASE ?? 'https://api.openai.com/v1').trim()
  const directModelsRaw = (process.env.OPENAI_DIRECT_MODELS ?? 'gpt-4o,gpt-4o-mini').trim()
  if (directKey && directKey.length > 10) {
    const directModels = directModelsRaw.split(',').map(m => m.trim()).filter(Boolean)
    for (const modelName of directModels) {
      const providerId = `openai-direct-${sanitizeModelId(modelName)}`
      chain.push({
        name: providerId,
        baseUrl: directBase,
        apiKey: directKey,
        modelOverride: modelName,
        fallbackTo: providerFallbackMap[providerId] ?? ['fandai-gemini-31', 'fandai-glm-5'],
      })
    }
  }

  if (deepseekKey && deepseekKey.length > 10) {
    chain.push({
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: deepseekKey,
      modelOverride: 'deepseek-chat',
      fallbackTo: providerFallbackMap['deepseek'] ?? ['fandai-gemini-31', 'fandai-glm-5'],
    })
  }

  if (moonshotKey && moonshotKey.length > 10) {
    chain.push({
      name: 'moonshot',
      baseUrl: 'https://api.moonshot.cn/v1',
      apiKey: moonshotKey,
      modelOverride: 'kimi-k2.5',
      fallbackTo: providerFallbackMap['moonshot'] ?? ['fandai-gemini-31', 'fandai-glm-5'],
    })
  }

  if (siliconflowKey && siliconflowKey.length > 10) {
    chain.push({
      name: 'siliconflow',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKey: siliconflowKey,
      modelOverride: 'deepseek-ai/DeepSeek-V3',
      fallbackTo: providerFallbackMap['siliconflow'] ?? ['fandai-gemini-31', 'fandai-glm-5'],
    })
  }

  chain.push({
    name: 'ollama-local',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    modelOverride: 'qwen2.5:7b',
  })

  return chain
}

async function pollOpenClawSession(apiBase: string, sessionId: string, timeoutSeconds: number): Promise<{ sessionId: string; status: string; result?: string }> {
  const pollInterval = 3000
  const maxPolls = Math.ceil((timeoutSeconds * 1000) / pollInterval)

  for (let i = 0; i < maxPolls; i++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval))

    try {
      const statusUrl = new URL(`${apiBase}/api/sessions/${sessionId}/status`)
      const result = await new Promise<{ status: string; result?: string }>((resolve, reject) => {
        const isHttps = statusUrl.protocol === 'https:'
        const fn = isHttps ? httpsRequest : httpRequest
        const req = fn({
          hostname: statusUrl.hostname,
          port: statusUrl.port || (isHttps ? 443 : 80),
          path: statusUrl.pathname,
          method: 'GET',
          timeout: 10000,
        }, (res) => {
          let body = ''
          res.on('data', (c: Buffer) => { body += c.toString() })
          res.on('end', () => {
            try { resolve(JSON.parse(body) as { status: string; result?: string }) }
            catch { reject(new Error('Invalid JSON from OpenClaw status')) }
          })
        })
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('Status poll timeout')) })
        req.end()
      })

      if (result.status === 'completed' || result.status === 'error') {
        return { sessionId, ...result }
      }
    } catch { /* retry */ }
  }

  return { sessionId, status: 'timeout' }
}

server.listen(port, '127.0.0.1', () => {
  console.log(`Writeback API listening on http://127.0.0.1:${port}`)
  console.log(`Company data root: ${dataRoot}`)
  const chain = buildLlmProviderChain()
  console.log(`LLM provider chain (${chain.length}): ${chain.map(p => {
    const model = p.modelOverride ? ` → ${p.modelOverride}` : ''
    return `${p.name}${model}`
  }).join(' → ')}`)
})
