import 'dotenv/config'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { parseCliInput } from './lib/cliInput'
import { exportSnapshot } from './lib/exportSnapshot'
import { createPrismaClient } from './lib/prismaClient'

const prisma = createPrismaClient()

type PaySalaryInput = {
  agentId?: string
}

function parseInput(): PaySalaryInput {
  return parseCliInput<PaySalaryInput>()
}

async function main() {
  const input = parseInput()

  const agents = input.agentId
    ? await prisma.agent.findMany({ where: { id: input.agentId, salaryBase: { gt: 0 } } })
    : await prisma.agent.findMany({ where: { salaryBase: { gt: 0 } } })

  if (agents.length === 0) {
    throw new Error('No eligible agents found for salary payment')
  }

  const treasury = await prisma.treasury.findFirst()
  if (!treasury) {
    throw new Error('Treasury not found')
  }

  const totalSalary = agents.reduce((sum, agent) => sum + agent.salaryBase, 0)
  if (treasury.availableBalance < totalSalary) {
    throw new Error(`Insufficient treasury balance: need ${totalSalary}, have ${treasury.availableBalance}`)
  }

  const operations = []

  for (const agent of agents) {
    const ledgerId = `ledger_${randomUUID().replace(/-/g, '').slice(0, 12)}`
    operations.push(
      prisma.agent.update({
        where: { id: agent.id },
        data: { walletBalance: { increment: agent.salaryBase } },
      }),
      prisma.tokenLedger.create({
        data: {
          id: ledgerId,
          fromAccount: 'treasury_main',
          toAccount: agent.id,
          amount: agent.salaryBase,
          ledgerType: 'salary',
          reason: `周期工资发放 - ${agent.name}`,
        },
      }),
    )
  }

  operations.push(
    prisma.treasury.update({
      where: { id: treasury.id },
      data: {
        availableBalance: { decrement: totalSalary },
        reservedBalance: { increment: totalSalary },
      },
    }),
  )

  await prisma.$transaction(operations)

  const outputPath = await exportSnapshot(prisma)
  console.log(JSON.stringify({
    ok: true,
    paidAgents: agents.length,
    totalSalary,
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
