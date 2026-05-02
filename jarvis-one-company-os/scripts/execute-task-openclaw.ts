import 'dotenv/config'
import process from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { parseCliInput } from './lib/cliInput'
import { exportSnapshot } from './lib/exportSnapshot'
import { createPrismaClient } from './lib/prismaClient'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const prisma = createPrismaClient()

type ExecuteTaskInput = {
  taskId: string
  operatorId?: string
  dryRun?: boolean
}

type AgentConfig = {
  openclawId: string
  label: string
  capabilities: string[]
  maxConcurrentTasks: number
  taskTypes: string[]
}

type OpenClawConfig = {
  openclawApiBase: string
  defaultTimeoutSeconds: number
  agents: Record<string, AgentConfig>
}

function loadOpenClawConfig(): OpenClawConfig {
  const configPath = path.resolve(__dirname, '..', 'config', 'openclaw-agents.json')
  return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as OpenClawConfig
}

function findOpenClawCli(): string {
  const candidates = [
    path.join(process.env.APPDATA ?? '', 'npm', 'openclaw.cmd'),
    path.join(process.env.APPDATA ?? '', 'npm', 'openclaw'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return 'openclaw'
}

function buildTaskPrompt(task: {
  title: string
  description: string
  taskType: string
  budgetToken: number
  dueAt: Date | null
}, agentName: string): string {
  const deadline = task.dueAt ? task.dueAt.toISOString().slice(0, 10) : '无固定截止'
  return [
    `你是「${agentName}」角色，请执行以下任务：`,
    '',
    `## 任务信息`,
    `- **标题**：${task.title}`,
    `- **描述**：${task.description}`,
    `- **类型**：${task.taskType}`,
    `- **预算**：${task.budgetToken} Token`,
    `- **截止**：${deadline}`,
    '',
    `## 执行要求`,
    `1. 严格按照任务描述执行，不超出范围`,
    `2. 预算消耗控制在 ${task.budgetToken} Token 以内`,
    `3. 完成后输出结构化的执行报告`,
    '',
    `## 输出格式`,
    '```json',
    '{',
    '  "status": "completed",',
    '  "deliverables": ["交付物1", "交付物2"],',
    '  "summary": "执行摘要",',
    '  "tokenUsed": 0,',
    '  "issues": [],',
    '  "nextSteps": []',
    '}',
    '```',
  ].join('\n')
}

function runOpenClawAgent(
  cliPath: string,
  agentId: string,
  message: string,
  timeoutSeconds: number,
): { status: string; result?: string; sessionId?: string } {
  const sessionId = `jarvis-task-${randomUUID().slice(0, 8)}`
  try {
    const stdout = execFileSync(cliPath, [
      'agent',
      '--agent', agentId,
      '--session-id', sessionId,
      '--message', message,
      '--timeout', String(timeoutSeconds),
      '--json',
    ], {
      timeout: (timeoutSeconds + 30) * 1000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let parsed: Record<string, unknown> | null = null
    for (const line of stdout.split('\n').reverse()) {
      const trimmed = line.trim()
      if (trimmed.startsWith('{')) {
        try { parsed = JSON.parse(trimmed); break } catch { /* skip non-json lines */ }
      }
    }

    if (parsed) {
      return {
        status: 'completed',
        result: JSON.stringify(parsed),
        sessionId,
      }
    }

    return { status: 'completed', result: stdout.trim(), sessionId }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('ETIMEDOUT') || msg.includes('timed out')) {
      return { status: 'timeout', sessionId }
    }
    throw error
  }
}

async function main() {
  const input = parseCliInput<ExecuteTaskInput>()

  const task = await prisma.task.findUnique({
    where: { id: input.taskId },
    include: { owner: true },
  })
  if (!task) throw new Error(`Task not found: ${input.taskId}`)

  if (!['approved', 'in_progress'].includes(task.status)) {
    throw new Error(`Task is in "${task.status}" status, cannot execute (needs "approved" or "in_progress")`)
  }

  const config = loadOpenClawConfig()
  const cliPath = findOpenClawCli()

  const taskTypeToAgentKey: Record<string, string> = {
    tech: 'agent_hermione',
    product: 'agent_mcgonagall',
    growth: 'agent_luna',
    sales: 'agent_fred',
    finance: 'agent_percy',
    audit: 'agent_snape',
    customer: 'agent_dobby',
    ops: 'agent_jarvis',
  }

  let agentConfig = config.agents[task.ownerAgentId]
  if (!agentConfig) {
    const fallbackKey = taskTypeToAgentKey[task.taskType] ?? 'agent_jarvis'
    agentConfig = config.agents[fallbackKey]
  }
  if (!agentConfig) {
    throw new Error(`No OpenClaw agent mapped for ${task.ownerAgentId} (taskType: ${task.taskType})`)
  }

  const taskPrompt = buildTaskPrompt(
    {
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      budgetToken: task.budgetToken,
      dueAt: task.dueAt,
    },
    task.owner.name,
  )

  if (input.dryRun) {
    console.log(JSON.stringify({
      ok: true,
      mode: 'dry_run',
      taskId: task.id,
      openclawAgent: agentConfig.openclawId,
      prompt: taskPrompt,
    }))
    return
  }

  if (task.status === 'approved') {
    await prisma.$transaction([
      prisma.task.update({ where: { id: task.id }, data: { status: 'in_progress', startedAt: new Date() } }),
      prisma.agent.update({ where: { id: task.ownerAgentId }, data: { status: 'busy' } }),
      prisma.taskLog.create({
        data: {
          id: `log_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          taskId: task.id,
          operatorId: input.operatorId ?? task.ownerAgentId,
          actionType: 'start',
          detailJson: JSON.stringify({
            note: 'OpenClaw 自动执行启动',
            previousStatus: task.status,
            newStatus: 'in_progress',
            openclawAgent: agentConfig.openclawId,
          }),
        },
      }),
    ])
  }

  let sessionResult: { status: string; result?: string; sessionId?: string }

  try {
    sessionResult = runOpenClawAgent(
      cliPath,
      agentConfig.openclawId,
      taskPrompt,
      config.defaultTimeoutSeconds,
    )
  } catch (error) {
    await prisma.taskLog.create({
      data: {
        id: `log_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        taskId: task.id,
        operatorId: input.operatorId ?? task.ownerAgentId,
        actionType: 'submit_review',
        detailJson: JSON.stringify({
          note: `OpenClaw 调用失败: ${error instanceof Error ? error.message : String(error)}`,
          openclawAgent: agentConfig.openclawId,
          error: true,
        }),
      },
    })

    await exportSnapshot(prisma)
    console.log(JSON.stringify({
      ok: false,
      taskId: task.id,
      error: error instanceof Error ? error.message : String(error),
      hint: 'OpenClaw 服务可能未启动，请检查连接',
    }))
    return
  }

  if (sessionResult.status === 'completed') {
    await prisma.$transaction([
      prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'review',
          deliverablesJson: sessionResult.result ?? '[]',
        },
      }),
      prisma.agent.update({
        where: { id: task.ownerAgentId },
        data: { status: 'review' },
      }),
      prisma.taskLog.create({
        data: {
          id: `log_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          taskId: task.id,
          operatorId: task.ownerAgentId,
          actionType: 'submit_review',
          detailJson: JSON.stringify({
            note: 'OpenClaw 执行完成，进入审核',
            openclawSessionId: sessionResult.sessionId,
            result: sessionResult.result?.slice(0, 500),
          }),
        },
      }),
    ])
  } else {
    await prisma.taskLog.create({
      data: {
        id: `log_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        taskId: task.id,
        operatorId: task.ownerAgentId,
        actionType: 'submit_review',
        detailJson: JSON.stringify({
          note: `OpenClaw 执行状态: ${sessionResult.status}`,
          openclawSessionId: sessionResult.sessionId,
        }),
      },
    })
  }

  const outputPath = await exportSnapshot(prisma)
  console.log(JSON.stringify({
    ok: true,
    taskId: task.id,
    openclawSessionId: sessionResult.sessionId,
    executionStatus: sessionResult.status,
    snapshot: outputPath,
  }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
