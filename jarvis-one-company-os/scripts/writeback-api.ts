import process from 'node:process'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
const port = Number(process.env.WRITEBACK_API_PORT ?? 18782)

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

function runScript(scriptFile: string, payload: JsonRecord) {
  return new Promise<JsonRecord>((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs'),
      scriptFile,
      JSON.stringify(payload),
    ], {
      cwd: projectRoot,
      env: process.env,
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

    if (request.url === '/api/llm/models' && request.method === 'POST') {
      const providers = buildLlmProviderChain()
      const models = [
        { id: 'cascade', name: '自动级联 (Auto)', description: '按优先级依次尝试所有可用模型', provider: 'auto', isDefault: true },
        ...providers.map(p => ({
          id: p.name,
          name: p.modelOverride ?? p.name,
          description: `${p.name} → ${p.baseUrl.replace(/https?:\/\//, '').replace(/\/v1$/, '')}`,
          provider: p.name,
          isDefault: false,
        })),
      ]
      sendJson(response, 200, { ok: true, models } as unknown as JsonRecord)
      return
    }

    if (request.url === '/api/llm/chat') {
      const body = payload as Record<string, unknown>

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

      async function tryProvider(provider: LlmProvider): Promise<boolean> {
        const resolvedModel = provider.modelOverride ?? requestModel
        const postBody = JSON.stringify({ ...body, model: resolvedModel, provider: undefined })
        const targetUrl = new URL(`${provider.baseUrl}/chat/completions`)
        const isHttps = targetUrl.protocol === 'https:'
        const reqFn = isHttps ? httpsRequest : httpRequest

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
                console.log(`LLM provider ${provider.name} returned ${code}, will try next`)
                resolve(false)
              } else {
                safeReply(code, resBody)
                resolve(true)
              }
            })
            proxyRes.on('error', () => resolve(false))
          })
          proxyReq.on('error', () => resolve(false))
          proxyReq.on('timeout', () => { proxyReq.destroy(); resolve(false) })
          proxyReq.write(postBody)
          proxyReq.end()
        })
      }

      ;(async () => {
        const selectedProviders = targetProvider && targetProvider !== 'cascade'
          ? providers.filter(p => p.name === targetProvider)
          : providers

        if (selectedProviders.length === 0) {
          safeReply(400, JSON.stringify({ ok: false, error: `Unknown provider: ${targetProvider}` }))
          return
        }

        for (const provider of selectedProviders) {
          const ok = await tryProvider(provider)
          if (ok) return
          console.log(`LLM provider ${provider.name} failed, trying next...`)
        }
        safeReply(502, JSON.stringify({ ok: false, error: 'All LLM providers failed. Check API keys and network.' }))
      })()
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
      const agentsDir = path.resolve(projectRoot, '..', 'openclaw_agents')
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
      const agentsDir = path.resolve(projectRoot, '..', 'openclaw_agents')
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
      const agentsDir = path.resolve(projectRoot, '..', 'openclaw_agents')
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

    if (request.url === '/api/company/rules' && request.method === 'POST') {
      const rulesPath = path.resolve(projectRoot, '..', 'config', 'company-rules.md')
      let content = ''
      if (fs.existsSync(rulesPath)) {
        try { content = fs.readFileSync(rulesPath, 'utf-8') } catch { /* empty */ }
      }
      sendJson(response, 200, { ok: true, content } as unknown as JsonRecord)
      return
    }

    // ─── 全公司统一技能引擎 ───

    if (request.url === '/api/skills/list' && request.method === 'POST') {
      const body = payload as { agentId?: string }
      const agentsRoot = path.resolve(projectRoot, '..', 'openclaw_agents')
      const allSkills: { id: string; name: string; description: string; agentId: string; agentName: string; type: string; available: boolean }[] = []

      const agentNames: Record<string, string> = {
        'jarvis-coo': '贾维斯', 'hermione-tech': '赫敏', 'mcgonagall-product': '麦格教授',
        'luna-growth': '卢娜', 'fred-sales': '弗雷德', 'percy-finance': '珀西',
        'snape-audit': '斯内普', 'dobby-customer': '多比', 'req-review-agent': '需求审核',
      }

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

    if (request.url === '/api/skills/run' && request.method === 'POST') {
      const body = payload as { skillId?: string; agentId?: string; args?: string }
      const skillId = body.skillId ?? ''
      const agentsRoot = path.resolve(projectRoot, '..', 'openclaw_agents')

      // Built-in: ones_check_status
      if (skillId === 'ones_check_status') {
        const reqDir = path.join(agentsRoot, 'req-review-agent')
        const pendingPath = path.join(reqDir, 'memory', 'pending_reviews.json')
        const processedPath = path.join(reqDir, 'memory', 'processed_log.json')
        let pendingCount = 0, processedCount = 0
        try { const d = JSON.parse(fs.readFileSync(pendingPath, 'utf-8')); pendingCount = Array.isArray(d) ? d.length : Object.keys(d).length } catch {}
        try { const d = JSON.parse(fs.readFileSync(processedPath, 'utf-8')); processedCount = Array.isArray(d) ? d.length : 0 } catch {}

        let tokenStatus = '未知'
        try {
          const cache = JSON.parse(fs.readFileSync(path.join(reqDir, 'token_cache.json'), 'utf-8'))
          if (cache.ones_lt) {
            const decoded = JSON.parse(Buffer.from(cache.ones_lt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
            tokenStatus = (decoded.exp ?? 0) * 1000 > Date.now() ? '有效' : '已过期'
          }
        } catch {}

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
          const c = spawn(pythonCmd, [scriptPath], { cwd: reqDir, detached: true, stdio: 'ignore', env: { ...process.env } })
          c.unref()
          sendJson(response, 200, { ok: true, result: { message: `卡片监听已启动 (PID: ${c.pid})`, pid: c.pid } } as unknown as JsonRecord)
          return
        }
        const c = spawn(pythonCmd, [scriptPath], { cwd: reqDir, env: { ...process.env }, timeout: 120000 })
        let sout = '', serr = ''
        c.stdout?.on('data', (d: Buffer) => { sout += d.toString() })
        c.stderr?.on('data', (d: Buffer) => { serr += d.toString() })
        c.on('close', (code) => {
          const output = (sout + '\n' + serr).trim()
          let parsed: unknown = null
          try { const jl = output.split('\n').filter(l => l.trim().startsWith('{')); if (jl.length) parsed = JSON.parse(jl[jl.length - 1]) } catch {}
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

      if (!foundAgent) {
        for (const entry of fs.readdirSync(agentsRoot, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          const sp = path.join(agentsRoot, entry.name, 'skills.json')
          if (!fs.existsSync(sp)) continue
          try {
            const skills = JSON.parse(fs.readFileSync(sp, 'utf-8')) as { id: string; script?: string; timeout?: number; type?: string }[]
            const match = skills.find(s => s.id === skillId)
            if (match) { foundAgent = entry.name; foundScript = match.script ?? ''; foundTimeout = match.timeout ?? 60; foundType = match.type ?? 'script'; break }
          } catch {}
        }
      } else {
        const sp = path.join(agentsRoot, foundAgent, 'skills.json')
        if (fs.existsSync(sp)) {
          try {
            const skills = JSON.parse(fs.readFileSync(sp, 'utf-8')) as { id: string; script?: string; timeout?: number; type?: string }[]
            const match = skills.find(s => s.id === skillId)
            if (match) { foundScript = match.script ?? ''; foundTimeout = match.timeout ?? 60; foundType = match.type ?? 'script' }
          } catch {}
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
      const child = spawn(pythonCmd, args, { cwd: agentDir, env: { ...process.env }, timeout: foundTimeout * 1000 })

      let stdout = '', stderr = ''
      child.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
      child.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

      child.on('close', (code) => {
        const output = (stdout + '\n' + stderr).trim()
        let parsed: Record<string, unknown> | null = null
        try { const jl = output.split('\n').filter(l => l.trim().startsWith('{')); if (jl.length) parsed = JSON.parse(jl[jl.length - 1]) as Record<string, unknown> } catch {}
        const summary = (parsed?.summary as string) ?? (code === 0 ? '执行成功' : `执行失败 (exit ${code})`)
        sendJson(response, 200, { ok: parsed?.ok ?? (code === 0), result: { exitCode: code, output: output.slice(-2000), parsed, message: summary, summary, agentId: foundAgent } } as unknown as JsonRecord)
      })
      child.on('error', (err) => { sendJson(response, 200, { ok: false, result: { message: `启动失败: ${err.message}`, agentId: foundAgent } } as unknown as JsonRecord) })
      return
    }

    if (request.url === '/api/openclaw/skills' && request.method === 'POST') {
      const skillDirs = [
        path.resolve(projectRoot, '..', 'skills'),
        path.resolve(projectRoot, '..', 'openclaw_skills'),
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

      const rootDir = path.resolve(projectRoot, '..')
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

      const rootDir = path.resolve(projectRoot, '..')
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
          const req = fetchFn({
            hostname: targetUrl.hostname,
            port: targetUrl.port || (isHttps ? 443 : 80),
            path: targetUrl.pathname + targetUrl.search,
            method: 'GET',
            timeout: 10000,
            headers: { 'User-Agent': 'JarvisBot/1.0' },
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
      } catch (e) {
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
}

function buildLlmProviderChain(): LlmProvider[] {
  const chain: LlmProvider[] = []

  const openaiKey = process.env.OPENAI_API_KEY ?? ''
  const deepseekKey = process.env.DEEPSEEK_API_KEY ?? ''
  const moonshotKey = process.env.MOONSHOT_API_KEY ?? ''
  const siliconflowKey = process.env.SILICONFLOW_API_KEY ?? ''
  const explicitBase = process.env.LLM_API_BASE
  const explicitKey = process.env.LLM_API_KEY

  if (explicitBase && explicitBase !== 'http://localhost:11434/v1') {
    chain.push({
      name: 'configured',
      baseUrl: explicitBase,
      apiKey: explicitKey ?? openaiKey,
    })
  }

  if (openaiKey && openaiKey.length > 10) {
    const isFandai = openaiKey.startsWith('sk-fandai')
    if (isFandai) {
      const fandaiBase = 'https://sxzhong10667.eu.cc/v1'
      const fandaiModels = [
        { name: 'fandai-nn4.6',         model: 'Nshen-NN-4.6' },
        { name: 'fandai-gemini3.1',     model: 'Nshen-gemini-3.1' },
        { name: 'fandai-gpt5.4',        model: 'gpt-5.4' },
        { name: 'fandai-nshen5.4-med',  model: 'Nshen-5.4-medium' },
        { name: 'fandai-nshen-mini',    model: 'Nshen-mini' },
      ]
      for (const fm of fandaiModels) {
        chain.push({ name: fm.name, baseUrl: fandaiBase, apiKey: openaiKey, modelOverride: fm.model })
      }
    } else {
      const openaiBase = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
      chain.push({ name: 'openai', baseUrl: openaiBase, apiKey: openaiKey, modelOverride: 'gpt-4o' })
    }
  }

  if (deepseekKey && deepseekKey.length > 10) {
    chain.push({
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: deepseekKey,
      modelOverride: 'deepseek-chat',
    })
  }

  if (moonshotKey && moonshotKey.length > 10) {
    chain.push({
      name: 'moonshot',
      baseUrl: 'https://api.moonshot.cn/v1',
      apiKey: moonshotKey,
      modelOverride: 'kimi-k2.5',
    })
  }

  if (siliconflowKey && siliconflowKey.length > 10) {
    chain.push({
      name: 'siliconflow',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKey: siliconflowKey,
      modelOverride: 'deepseek-ai/DeepSeek-V3',
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
  const chain = buildLlmProviderChain()
  console.log(`LLM provider chain (${chain.length}): ${chain.map(p => {
    const model = p.modelOverride ? ` → ${p.modelOverride}` : ''
    return `${p.name}${model}`
  }).join(' → ')}`)
})
