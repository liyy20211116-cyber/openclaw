import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { exportSnapshot } from './lib/exportSnapshot'
import { createPrismaClient } from './lib/prismaClient'

const prisma = createPrismaClient()

const evidenceTaskId = 'commercial_evidence_local_loop_001'
const evidenceWorkflowRunId = 'commercial_evidence_workflow_001'
const evidenceRevenueId = 'commercial_evidence_revenue_001'

async function getAgentId(preferredCodes: string[], fallbackCode: string) {
  const agent = await prisma.agent.findFirst({
    where: { OR: preferredCodes.flatMap(code => [{ code }, { id: `agent_${code}` }]) },
    select: { id: true },
  })
  if (agent) return agent.id

  const fallback = await prisma.agent.findFirst({ select: { id: true } })
  if (fallback) return fallback.id

  const id = `agent_${fallbackCode}`
  await prisma.agent.create({
    data: {
      id,
      code: fallbackCode,
      name: fallbackCode,
      role: 'Fallback Agent',
      department: 'Operations',
      persona: 'Fallback local evidence agent',
      goalsJson: '[]',
      permissionsJson: '{}',
      salaryBase: 0,
      walletBalance: 0,
      bonusBalance: 0,
      complianceScore: 100,
      status: 'idle',
    },
  })
  return id
}

async function ensureTreasury() {
  const treasury = await prisma.treasury.findFirst()
  if (treasury) return treasury.id
  await prisma.treasury.create({
    data: {
      id: 'treasury_main',
      totalBalance: 0,
      reservedBalance: 0,
      availableBalance: 0,
    },
  })
  return 'treasury_main'
}

async function main() {
  const creatorAgentId = await getAgentId(['jarvis', 'ceo'], 'jarvis')
  const ownerAgentId = await getAgentId(['fred', 'luna', 'hermione'], 'fred')
  const treasuryId = await ensureTreasury()
  const now = new Date()

  await prisma.task.upsert({
    where: { id: evidenceTaskId },
    create: {
      id: evidenceTaskId,
      title: 'Local commercial readiness evidence loop',
      description: 'Local evidence row for task -> execution -> delivery -> revenue -> token ledger. This is not a real customer payment.',
      taskType: 'sales',
      creatorAgentId,
      ownerAgentId,
      priority: 'high',
      status: 'completed',
      budgetToken: 500,
      spentToken: 320,
      requiresApproval: false,
      deliverablesJson: JSON.stringify(['commercial-readiness-local-evidence.md']),
      kpiJson: JSON.stringify({ localEvidence: true, realCustomerPayment: false }),
      startedAt: now,
      completedAt: now,
    },
    update: {
      status: 'completed',
      spentToken: 320,
      completedAt: now,
      deliverablesJson: JSON.stringify(['commercial-readiness-local-evidence.md']),
      kpiJson: JSON.stringify({ localEvidence: true, realCustomerPayment: false }),
    },
  })

  const existingLog = await prisma.taskLog.findFirst({
    where: { taskId: evidenceTaskId, actionType: 'complete' },
    select: { id: true },
  })
  if (!existingLog) {
    await prisma.taskLog.create({
      data: {
        id: `log_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        taskId: evidenceTaskId,
        operatorId: ownerAgentId,
        actionType: 'complete',
        detailJson: JSON.stringify({
          localEvidence: true,
          result: 'Local commercial readiness loop recorded.',
          realCustomerPayment: false,
        }),
      },
    })
  }

  await prisma.workflowRun.upsert({
    where: { id: evidenceWorkflowRunId },
    create: {
      id: evidenceWorkflowRunId,
      workflowId: 'commercial-readiness-local-loop',
      workflowName: 'Commercial readiness local evidence loop',
      status: 'completed',
      inputJson: JSON.stringify({ taskId: evidenceTaskId }),
      contextJson: JSON.stringify({ localEvidence: true, realCustomerPayment: false }),
      startedAt: now,
      completedAt: now,
    },
    update: {
      status: 'completed',
      contextJson: JSON.stringify({ localEvidence: true, realCustomerPayment: false }),
      completedAt: now,
    },
  })

  await prisma.workflowStep.upsert({
    where: { id: 'commercial_evidence_step_delivery_001' },
    create: {
      id: 'commercial_evidence_step_delivery_001',
      runId: evidenceWorkflowRunId,
      nodeId: 'delivery',
      agentId: ownerAgentId,
      skillId: 'local-commercial-evidence',
      label: 'Record local delivery evidence',
      status: 'completed',
      outputJson: JSON.stringify({ artifact: 'commercial-readiness-local-evidence.md' }),
      attempts: 1,
      startedAt: now,
      completedAt: now,
    },
    update: {
      status: 'completed',
      outputJson: JSON.stringify({ artifact: 'commercial-readiness-local-evidence.md' }),
      completedAt: now,
    },
  })

  await prisma.revenue.upsert({
    where: { id: evidenceRevenueId },
    create: {
      id: evidenceRevenueId,
      title: 'Local evidence revenue entry',
      businessLine: 'AI Automation',
      source: 'local-readiness-evidence',
      amountFiat: '1',
      mappedToken: 100,
      relatedTaskId: evidenceTaskId,
      note: 'local evidence only; not a real customer payment',
    },
    update: {
      amountFiat: '1',
      mappedToken: 100,
      relatedTaskId: evidenceTaskId,
      note: 'local evidence only; not a real customer payment',
    },
  })

  await prisma.tokenLedger.deleteMany({
    where: {
      relatedTaskId: evidenceTaskId,
      reason: { contains: 'local evidence' },
    },
  })
  await prisma.tokenLedger.createMany({
    data: [
      {
        id: `ledger_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        fromAccount: 'revenue_pool',
        toAccount: ownerAgentId,
        amount: 25,
        ledgerType: 'reward',
        reason: 'local evidence revenue reward',
        relatedTaskId: evidenceTaskId,
      },
      {
        id: `ledger_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        fromAccount: 'revenue_pool',
        toAccount: treasuryId,
        amount: 75,
        ledgerType: 'revenue_share',
        reason: 'local evidence treasury share',
        relatedTaskId: evidenceTaskId,
      },
    ],
  })

  await prisma.agent.update({
    where: { id: ownerAgentId },
    data: {
      walletBalance: { increment: 25 },
      bonusBalance: { increment: 25 },
    },
  })
  await prisma.treasury.update({
    where: { id: treasuryId },
    data: {
      totalBalance: { increment: 100 },
      availableBalance: { increment: 75 },
    },
  })

  const snapshot = await exportSnapshot(prisma)
  console.log(JSON.stringify({ ok: true, taskId: evidenceTaskId, workflowRunId: evidenceWorkflowRunId, revenueId: evidenceRevenueId, snapshot }))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
