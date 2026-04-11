import 'dotenv/config'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { TaskPriority, TaskStatus, TaskType } from '../src/generated/prisma/enums'
import { parseCliInput } from './lib/cliInput'
import { exportSnapshot } from './lib/exportSnapshot'
import { createPrismaClient } from './lib/prismaClient'

const prisma = createPrismaClient()

type CreateTaskInput = {
  title: string
  description: string
  taskType: keyof typeof TaskType
  creatorAgentId: string
  ownerAgentId: string
  priority: keyof typeof TaskPriority
  budgetToken: number
  dueAt?: string
  requiresApproval?: boolean
  approverId?: string
  taskId?: string
  sourceApprovalId?: string
}

function parseInput(): CreateTaskInput {
  return parseCliInput<CreateTaskInput>()
}

async function resolveAgentId(idOrCode: string): Promise<string> {
  const agent = await prisma.agent.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    select: { id: true },
  })
  return agent?.id ?? (idOrCode.startsWith('agent_') ? idOrCode : `agent_${idOrCode}`)
}

async function main() {
  const input = parseInput()
  const isUpdate = typeof input.taskId === 'string' && input.taskId.length > 0
  const taskId = input.taskId ?? `task_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  const taskStatus = input.requiresApproval ? TaskStatus.pending_approval : TaskStatus.draft

  const creatorId = await resolveAgentId(input.creatorAgentId)
  const ownerId = await resolveAgentId(input.ownerAgentId)
  const approverId = input.approverId
    ? await resolveAgentId(input.approverId)
    : (input.requiresApproval ? 'agent_ceo' : null)

  if (isUpdate) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        title: input.title,
        description: input.description,
        taskType: TaskType[input.taskType],
        ownerAgentId: ownerId,
        priority: TaskPriority[input.priority],
        status: taskStatus,
        budgetToken: input.budgetToken,
        requiresApproval: Boolean(input.requiresApproval),
        approverId,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      },
    })

    await prisma.taskLog.create({
      data: {
        id: `log_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        taskId,
        operatorId: creatorId,
        actionType: 'assign',
        detailJson: JSON.stringify({
          title: input.title,
          sourceApprovalId: input.sourceApprovalId ?? '',
          mode: 'resubmit',
          requiresApproval: Boolean(input.requiresApproval),
        }),
      },
    })

    if (input.sourceApprovalId) {
      await prisma.approval.update({
        where: { id: input.sourceApprovalId },
        data: {
          decisionNote: `任务已修正并重新提交：${input.title}`,
        },
      })
    }

    if (input.requiresApproval && approverId) {
      await prisma.approval.create({
        data: {
          id: `approval_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          targetType: 'task',
          targetId: taskId,
          requesterId: creatorId,
          approverId,
          status: 'pending',
          reason: `为修正后的任务「${input.title}」重新申请审批`,
        },
      })
    }
  } else {
    await prisma.task.create({
      data: {
        id: taskId,
        title: input.title,
        description: input.description,
        taskType: TaskType[input.taskType],
        creatorAgentId: creatorId,
        ownerAgentId: ownerId,
        priority: TaskPriority[input.priority],
        status: taskStatus,
        budgetToken: input.budgetToken,
        spentToken: 0,
        requiresApproval: Boolean(input.requiresApproval),
        approverId,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      },
    })

    await prisma.taskLog.create({
      data: {
        id: `log_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        taskId,
        operatorId: creatorId,
        actionType: 'create',
        detailJson: JSON.stringify({ title: input.title, requiresApproval: Boolean(input.requiresApproval), mode: 'create' }),
      },
    })

    if (input.requiresApproval && approverId) {
      await prisma.approval.create({
        data: {
          id: `approval_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          targetType: 'task',
          targetId: taskId,
          requesterId: creatorId,
          approverId,
          status: 'pending',
          reason: `为任务「${input.title}」申请审批`,
        },
      })
    }
  }

  const outputPath = await exportSnapshot(prisma)
  console.log(JSON.stringify({ ok: true, taskId, mode: isUpdate ? 'resubmit' : 'create', snapshot: outputPath }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
