import 'dotenv/config'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { parseCliInput } from './lib/cliInput'
import { exportSnapshot } from './lib/exportSnapshot'
import { createPrismaClient } from './lib/prismaClient'

const prisma = createPrismaClient()

type AddRevenueInput = {
  title: string
  businessLine: string
  source: string
  amountFiat: number
  mappedToken: number
  relatedTaskId?: string
  note?: string
}

const AGENT_SHARE_RATIO = 0.25

function parseInput(): AddRevenueInput {
  return parseCliInput<AddRevenueInput>()
}

async function main() {
  const input = parseInput()
  const revenueId = `revenue_${randomUUID().replace(/-/g, '').slice(0, 12)}`

  const operations = []

  operations.push(
    prisma.revenue.create({
      data: {
        id: revenueId,
        title: input.title,
        businessLine: input.businessLine,
        source: input.source,
        amountFiat: String(input.amountFiat),
        mappedToken: input.mappedToken,
        relatedTaskId: input.relatedTaskId ?? null,
        note: input.note ?? null,
      },
    }),
  )

  let agentShare = 0
  let treasuryShare = input.mappedToken

  if (input.relatedTaskId) {
    const task = await prisma.task.findUnique({ where: { id: input.relatedTaskId } })
    if (task) {
      agentShare = Math.floor(input.mappedToken * AGENT_SHARE_RATIO)
      treasuryShare = input.mappedToken - agentShare

      if (agentShare > 0) {
        const rewardLedgerId = `ledger_${randomUUID().replace(/-/g, '').slice(0, 12)}`
        operations.push(
          prisma.tokenLedger.create({
            data: {
              id: rewardLedgerId,
              fromAccount: 'revenue_pool',
              toAccount: task.ownerAgentId,
              amount: agentShare,
              ledgerType: 'reward',
              reason: `收入分账奖励：${input.title}`,
              relatedTaskId: task.id,
            },
          }),
          prisma.agent.update({
            where: { id: task.ownerAgentId },
            data: {
              walletBalance: { increment: agentShare },
              bonusBalance: { increment: agentShare },
            },
          }),
        )
      }
    }
  }

  const treasuryLedgerId = `ledger_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  operations.push(
    prisma.tokenLedger.create({
      data: {
        id: treasuryLedgerId,
        fromAccount: 'revenue_pool',
        toAccount: 'treasury_main',
        amount: treasuryShare,
        ledgerType: 'revenue_share',
        reason: `收入国库沉淀：${input.title}`,
        relatedTaskId: input.relatedTaskId ?? null,
      },
    }),
    prisma.treasury.updateMany({
      data: {
        totalBalance: { increment: input.mappedToken },
        availableBalance: { increment: treasuryShare },
      },
    }),
  )

  await prisma.$transaction(operations)

  const outputPath = await exportSnapshot(prisma)
  console.log(JSON.stringify({
    ok: true,
    revenueId,
    agentShare,
    treasuryShare,
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
