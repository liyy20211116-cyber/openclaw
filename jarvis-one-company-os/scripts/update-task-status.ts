import 'dotenv/config'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { parseCliInput } from './lib/cliInput'
import { exportSnapshot } from './lib/exportSnapshot'
import { createPrismaClient } from './lib/prismaClient'

const prisma = createPrismaClient()

type UpdateTaskStatusInput = {
  taskId: string
  action: 'start' | 'submit_review' | 'complete' | 'freeze'
  operatorId: string
  note?: string
}

const actionToStatus: Record<string, string> = {
  start: 'in_progress',
  submit_review: 'review',
  complete: 'completed',
  freeze: 'frozen',
}

const validTransitions: Record<string, string[]> = {
  start: ['approved', 'draft'],
  submit_review: ['in_progress'],
  complete: ['review', 'in_progress'],
  freeze: ['in_progress', 'review', 'approved', 'pending_approval', 'draft'],
}

function parseInput(): UpdateTaskStatusInput {
  return parseCliInput<UpdateTaskStatusInput>()
}

async function main() {
  const input = parseInput()

  const task = await prisma.task.findUnique({ where: { id: input.taskId } })
  if (!task) {
    throw new Error(`Task not found: ${input.taskId}`)
  }

  const allowed = validTransitions[input.action]
  if (!allowed || !allowed.includes(task.status)) {
    throw new Error(`Cannot ${input.action} a task in status "${task.status}"`)
  }

  const newStatus = actionToStatus[input.action]
  const now = new Date()
  const operations = []

  const updateData: Record<string, unknown> = { status: newStatus }
  if (input.action === 'start') {
    updateData.startedAt = now
  }
  if (input.action === 'complete') {
    updateData.completedAt = now
    updateData.spentToken = task.budgetToken
  }

  operations.push(
    prisma.task.update({ where: { id: input.taskId }, data: updateData }),
  )

  operations.push(
    prisma.taskLog.create({
      data: {
        id: `log_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        taskId: input.taskId,
        operatorId: input.operatorId,
        actionType: input.action,
        detailJson: JSON.stringify({
          note: input.note ?? '',
          previousStatus: task.status,
          newStatus,
        }),
      },
    }),
  )

  if (input.action === 'complete' && task.budgetToken > 0) {
    const ledgerId = `ledger_${randomUUID().replace(/-/g, '').slice(0, 12)}`
    operations.push(
      prisma.tokenLedger.create({
        data: {
          id: ledgerId,
          fromAccount: task.ownerAgentId,
          toAccount: 'task_cost',
          amount: task.budgetToken,
          ledgerType: 'budget',
          reason: `任务完成结算：${task.title}`,
          relatedTaskId: task.id,
        },
      }),
      prisma.agent.update({
        where: { id: task.ownerAgentId },
        data: { walletBalance: { decrement: task.budgetToken } },
      }),
    )
  }

  if (input.action === 'start') {
    operations.push(
      prisma.agent.update({
        where: { id: task.ownerAgentId },
        data: { status: 'busy' },
      }),
    )
  }

  if (input.action === 'complete') {
    operations.push(
      prisma.agent.update({
        where: { id: task.ownerAgentId },
        data: { status: 'idle' },
      }),
    )
  }

  await prisma.$transaction(operations)

  const outputPath = await exportSnapshot(prisma)
  console.log(JSON.stringify({ ok: true, taskId: input.taskId, action: input.action, newStatus, snapshot: outputPath }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
