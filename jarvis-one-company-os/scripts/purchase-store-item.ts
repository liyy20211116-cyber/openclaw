import 'dotenv/config'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { parseCliInput } from './lib/cliInput'
import { exportSnapshot } from './lib/exportSnapshot'
import { createPrismaClient } from './lib/prismaClient'

const prisma = createPrismaClient()

type PurchaseInput = {
  buyerAgentId: string
  itemId: string
  quantity: number
}

function parseInput(): PurchaseInput {
  return parseCliInput<PurchaseInput>()
}

async function main() {
  const input = parseInput()
  const quantity = input.quantity ?? 1

  const item = await prisma.storeItem.findUnique({ where: { id: input.itemId } })
  if (!item || !item.enabled) {
    throw new Error(`Store item ${input.itemId} not found or disabled`)
  }

  const agent = await prisma.agent.findUnique({ where: { id: input.buyerAgentId } })
  if (!agent) {
    throw new Error(`Agent ${input.buyerAgentId} not found`)
  }

  const totalPrice = item.priceToken * quantity
  if (agent.walletBalance < totalPrice) {
    throw new Error(`Insufficient balance: need ${totalPrice}, have ${agent.walletBalance}`)
  }

  if (item.stockMode === 'limited' && item.stockCount !== null && item.stockCount < quantity) {
    throw new Error(`Insufficient stock: need ${quantity}, have ${item.stockCount}`)
  }

  const orderId = `order_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  const ledgerId = `ledger_${randomUUID().replace(/-/g, '').slice(0, 12)}`

  await prisma.$transaction([
    prisma.storeOrder.create({
      data: {
        id: orderId,
        buyerAgentId: input.buyerAgentId,
        itemId: input.itemId,
        quantity,
        totalPrice,
        status: 'paid',
      },
    }),
    prisma.agent.update({
      where: { id: input.buyerAgentId },
      data: { walletBalance: { decrement: totalPrice } },
    }),
    prisma.tokenLedger.create({
      data: {
        id: ledgerId,
        fromAccount: agent.code,
        toAccount: 'store',
        amount: totalPrice,
        ledgerType: 'purchase',
        reason: `购买 ${item.name} x${quantity}`,
        relatedStoreItemId: input.itemId,
      },
    }),
    ...(item.stockMode === 'limited' && item.stockCount !== null
      ? [prisma.storeItem.update({
          where: { id: input.itemId },
          data: { stockCount: { decrement: quantity } },
        })]
      : []),
  ])

  const outputPath = await exportSnapshot(prisma)
  console.log(JSON.stringify({ ok: true, orderId, totalPrice, snapshot: outputPath }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
