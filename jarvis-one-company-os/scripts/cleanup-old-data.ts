import 'dotenv/config'
import { createPrismaClient } from './lib/prismaClient'
import { exportSnapshot } from './lib/exportSnapshot'

const prisma = createPrismaClient()

const oldTaskIds = ['task_mvp_definition', 'task_app_bootstrap', 'task_growth_plan', 'task_budget_rules']
const oldApprovalIds = ['approval_001', 'approval_002']
const oldAuditIds = ['audit_001', 'audit_002']
// oldLogIds not needed — logs are deleted by taskId cascade
// const oldLogIds = ['log_001', 'log_002', 'log_003']
const oldLedgerIds = ['ledger_001', 'ledger_002', 'ledger_003']
const oldRevenueIds = ['revenue_001', 'revenue_002']
const oldOrderIds = ['order_001']

async function main() {
  await prisma.storeOrder.deleteMany({ where: { id: { in: oldOrderIds } } })
  await prisma.tokenLedger.deleteMany({ where: { id: { in: oldLedgerIds } } })
  await prisma.revenue.deleteMany({ where: { id: { in: oldRevenueIds } } })
  await prisma.auditEvent.deleteMany({ where: { id: { in: oldAuditIds } } })
  await prisma.approval.deleteMany({ where: { id: { in: oldApprovalIds } } })
  await prisma.taskLog.deleteMany({ where: { taskId: { in: oldTaskIds } } })
  await prisma.task.deleteMany({ where: { id: { in: oldTaskIds } } })

  const tasks = await prisma.task.findMany({ select: { id: true, title: true, status: true } })
  const approvals = await prisma.approval.findMany({ select: { id: true, targetId: true, status: true } })

  console.log(`Tasks remaining: ${tasks.length}`)
  tasks.forEach(t => console.log(`  [${t.status}] ${t.title}`))
  console.log(`Approvals remaining: ${approvals.length}`)
  approvals.forEach(a => console.log(`  [${a.status}] ${a.targetId}`))

  const outputPath = await exportSnapshot(prisma)
  console.log(`Snapshot exported to ${outputPath}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
