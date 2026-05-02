import assert from 'node:assert/strict'
import { createPrismaClient } from './lib/prismaClient'

const prisma = createPrismaClient()

async function main() {
  const evidenceTasks = await prisma.task.count({
    where: {
      id: { startsWith: 'commercial_evidence_' },
      status: 'completed',
    },
  })
  const evidenceWorkflowRuns = await prisma.workflowRun.count({
    where: {
      workflowId: 'commercial-readiness-local-loop',
      status: 'completed',
    },
  })
  const evidenceRevenues = await prisma.revenue.count({
    where: {
      id: { startsWith: 'commercial_evidence_' },
      note: { contains: 'local evidence' },
    },
  })
  const evidenceLedger = await prisma.tokenLedger.count({
    where: {
      relatedTaskId: { startsWith: 'commercial_evidence_' },
      ledgerType: { in: ['reward', 'revenue_share'] },
    },
  })

  assert.equal(evidenceTasks >= 1, true, 'missing completed local evidence task')
  assert.equal(evidenceWorkflowRuns >= 1, true, 'missing completed local evidence workflow run')
  assert.equal(evidenceRevenues >= 1, true, 'missing local evidence revenue row')
  assert.equal(evidenceLedger >= 2, true, 'missing local evidence token ledger rows')

  console.log('commercial readiness evidence tests passed')
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
