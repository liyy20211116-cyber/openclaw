import 'dotenv/config'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { parseCliInput } from './lib/cliInput'
import { exportSnapshot } from './lib/exportSnapshot'
import { createPrismaClient } from './lib/prismaClient'

const prisma = createPrismaClient()

type AuditInspectionInput = {
  scope?: 'all' | 'recent'
}

type DetectedIssue = {
  taskId: string
  agentId: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  issueType: 'hallucination' | 'overspend' | 'unauthorized' | 'low_quality' | 'duplicate'
  detail: string
}

const OVERSPEND_THRESHOLD = 1.2
const OVERDUE_DAYS_LOW = 1
const OVERDUE_DAYS_MEDIUM = 3
const OVERDUE_DAYS_HIGH = 7
const MIN_DESCRIPTION_LENGTH = 10

async function inspectTasks(scope: 'all' | 'recent'): Promise<DetectedIssue[]> {
  const issues: DetectedIssue[] = []
  const now = new Date()

  const where = scope === 'recent'
    ? { status: { in: ['completed', 'in_progress', 'review'] as string[] } }
    : {}

  const tasks = await prisma.task.findMany({ where: where as Parameters<typeof prisma.task.findMany>[0] extends { where?: infer W } ? W : never })

  const existingEvents = await prisma.auditEvent.findMany({
    where: { status: { in: ['open', 'reviewing'] } },
    select: { taskId: true, issueType: true },
  })
  const existingKeys = new Set(existingEvents.map((e) => `${e.taskId}_${e.issueType}`))

  for (const task of tasks) {
    if (task.status === 'completed' && task.spentToken > task.budgetToken * OVERSPEND_THRESHOLD) {
      const key = `${task.id}_overspend`
      if (!existingKeys.has(key)) {
        const ratio = Math.round((task.spentToken / task.budgetToken) * 100)
        let riskLevel: 'medium' | 'high' | 'critical' = 'medium'
        if (ratio > 200) riskLevel = 'critical'
        else if (ratio > 150) riskLevel = 'high'

        issues.push({
          taskId: task.id,
          agentId: task.ownerAgentId,
          riskLevel,
          issueType: 'overspend',
          detail: `任务「${task.title}」预算 ${task.budgetToken} Token，实际花费 ${task.spentToken} Token，超支 ${ratio - 100}%`,
        })
      }
    }

    if (task.dueAt) {
      const dueDate = new Date(task.dueAt)
      const isOverdue =
        (task.status === 'in_progress' || task.status === 'review') && now > dueDate
        || (task.status === 'completed' && task.completedAt && task.completedAt > dueDate)

      if (isOverdue) {
        const key = `${task.id}_low_quality`
        if (!existingKeys.has(key)) {
          const overdueDate = task.status === 'completed' && task.completedAt ? task.completedAt : now
          const overdueDays = Math.ceil((overdueDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

          if (overdueDays >= OVERDUE_DAYS_LOW) {
            let riskLevel: 'low' | 'medium' | 'high' = 'low'
            if (overdueDays >= OVERDUE_DAYS_HIGH) riskLevel = 'high'
            else if (overdueDays >= OVERDUE_DAYS_MEDIUM) riskLevel = 'medium'

            issues.push({
              taskId: task.id,
              agentId: task.ownerAgentId,
              riskLevel,
              issueType: 'low_quality',
              detail: `任务「${task.title}」已超期 ${overdueDays} 天（截止日：${dueDate.toISOString().slice(0, 10)}）`,
            })
          }
        }
      }
    }

    if (task.description.length < MIN_DESCRIPTION_LENGTH) {
      const key = `${task.id}_low_quality`
      if (!existingKeys.has(key)) {
        issues.push({
          taskId: task.id,
          agentId: task.ownerAgentId,
          riskLevel: 'low',
          issueType: 'low_quality',
          detail: `任务「${task.title}」描述过于简短（${task.description.length} 字），不满足最低 ${MIN_DESCRIPTION_LENGTH} 字要求`,
        })
      }
    }
  }

  const agentTaskGroups = new Map<string, typeof tasks>()
  for (const task of tasks) {
    if (task.status === 'in_progress' || task.status === 'review') {
      const existing = agentTaskGroups.get(task.ownerAgentId) ?? []
      existing.push(task)
      agentTaskGroups.set(task.ownerAgentId, existing)
    }
  }

  for (const [agentId, agentTasks] of agentTaskGroups) {
    for (let i = 0; i < agentTasks.length; i++) {
      for (let j = i + 1; j < agentTasks.length; j++) {
        const titleA = agentTasks[i].title.toLowerCase()
        const titleB = agentTasks[j].title.toLowerCase()
        if (titleA === titleB || (titleA.includes(titleB) || titleB.includes(titleA))) {
          const key = `${agentTasks[j].id}_duplicate`
          if (!existingKeys.has(key)) {
            issues.push({
              taskId: agentTasks[j].id,
              agentId,
              riskLevel: 'medium',
              issueType: 'duplicate',
              detail: `任务「${agentTasks[j].title}」与「${agentTasks[i].title}」疑似重复`,
            })
          }
        }
      }
    }
  }

  return issues
}

async function main() {
  const input = parseCliInput<AuditInspectionInput>()
  const scope = input.scope ?? 'recent'

  const issues = await inspectTasks(scope)

  if (issues.length === 0) {
    const outputPath = await exportSnapshot(prisma)
    console.log(JSON.stringify({ ok: true, issuesFound: 0, message: '巡检通过，未发现异常', snapshot: outputPath }))
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const operations: any[] = issues.map((issue) =>
    prisma.auditEvent.create({
      data: {
        id: `audit_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        taskId: issue.taskId,
        agentId: issue.agentId,
        riskLevel: issue.riskLevel,
        issueType: issue.issueType,
        detail: issue.detail,
        status: 'open',
      },
    }),
  )

  const highRiskIssues = issues.filter((i) => i.riskLevel === 'high' || i.riskLevel === 'critical')
  for (const issue of highRiskIssues) {
    operations.push(
      prisma.agent.update({
        where: { id: issue.agentId },
        data: { complianceScore: { decrement: issue.riskLevel === 'critical' ? 10 : 5 } },
      }),
    )
  }

  await prisma.$transaction(operations)

  const outputPath = await exportSnapshot(prisma)
  console.log(JSON.stringify({
    ok: true,
    issuesFound: issues.length,
    highRisk: highRiskIssues.length,
    issues: issues.map((i) => ({ taskId: i.taskId, type: i.issueType, level: i.riskLevel })),
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
