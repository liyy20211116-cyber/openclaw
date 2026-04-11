import 'dotenv/config'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { parseCliInput } from './lib/cliInput'
import { exportSnapshot } from './lib/exportSnapshot'
import { createPrismaClient } from './lib/prismaClient'

const prisma = createPrismaClient()

type UpdateAuditInput = {
  eventId: string
  status: 'resolved' | 'ignored'
  freezeTask?: boolean
}

function parseInput(): UpdateAuditInput {
  return parseCliInput<UpdateAuditInput>()
}

async function main() {
  const input = parseInput()

  const event = await prisma.auditEvent.findUnique({ where: { id: input.eventId } })
  if (!event) {
    throw new Error(`Audit event not found: ${input.eventId}`)
  }

  const operations = []

  operations.push(
    prisma.auditEvent.update({
      where: { id: input.eventId },
      data: { status: input.status },
    }),
  )

  if (input.freezeTask && event.taskId) {
    const task = await prisma.task.findUnique({ where: { id: event.taskId } })
    if (task && !['completed', 'frozen', 'archived'].includes(task.status)) {
      operations.push(
        prisma.task.update({
          where: { id: event.taskId },
          data: { status: 'frozen' },
        }),
        prisma.taskLog.create({
          data: {
            id: `log_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
            taskId: event.taskId,
            operatorId: event.agentId,
            actionType: 'freeze',
            detailJson: JSON.stringify({
              reason: `审计冻结：${event.detail}`,
              auditEventId: event.id,
              riskLevel: event.riskLevel,
            }),
          },
        }),
      )
    }
  }

  await prisma.$transaction(operations)

  const outputPath = await exportSnapshot(prisma)
  console.log(JSON.stringify({
    ok: true,
    eventId: input.eventId,
    status: input.status,
    frozeTask: Boolean(input.freezeTask && event.taskId),
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
