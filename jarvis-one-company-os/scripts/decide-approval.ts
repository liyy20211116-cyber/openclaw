import 'dotenv/config'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { parseCliInput } from './lib/cliInput'
import { exportSnapshot } from './lib/exportSnapshot'
import { createPrismaClient } from './lib/prismaClient'

const prisma = createPrismaClient()

type ApprovalDecisionInput = {
  approvalId: string
  status: 'approved' | 'rejected'
  decisionNote?: string
}

function parseInput(): ApprovalDecisionInput {
  return parseCliInput<ApprovalDecisionInput>()
}

async function main() {
  const input = parseInput()
  const approval = await prisma.approval.findUnique({ where: { id: input.approvalId } })

  if (!approval) {
    throw new Error(`Approval not found: ${input.approvalId}`)
  }

  await prisma.approval.update({
    where: { id: input.approvalId },
    data: {
      status: input.status,
      decisionNote: input.decisionNote ?? null,
      decidedAt: new Date(),
    },
  })

  if (approval.targetType === 'task') {
    await prisma.task.update({
      where: { id: approval.targetId },
      data: {
        status: input.status === 'approved' ? 'approved' : 'rejected',
      },
    })

    await prisma.taskLog.create({
      data: {
        id: `log_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        taskId: approval.targetId,
        operatorId: approval.approverId,
        actionType: input.status === 'approved' ? 'approve' : 'reject',
        detailJson: JSON.stringify({ approvalId: approval.id, decisionNote: input.decisionNote ?? '' }),
      },
    })
  }

  const outputPath = await exportSnapshot(prisma)
  console.log(JSON.stringify({ ok: true, approvalId: approval.id, status: input.status, snapshot: outputPath }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
