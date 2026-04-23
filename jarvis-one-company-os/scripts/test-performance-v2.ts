import { createPrismaClient } from './lib/prismaClient'
import { evaluateAllAgentsV2, dumpReportToJson } from './lib/performanceEvaluator'
import { loadPerformanceHistory } from './lib/performanceLoader'

async function main() {
  const prisma = createPrismaClient()
  try {
    const report = await evaluateAllAgentsV2(prisma, { persist: true })
    const jsonPath = dumpReportToJson(report)

    console.log('=== Performance v2 Report ===')
    console.log(`reviewDate: ${report.reviewDate}`)
    console.log(`reviewer:   ${report.reviewer}`)
    console.log(`avgScore:   ${report.avgScore}`)
    console.log(`gradeDistribution: ${JSON.stringify(report.gradeDistribution)}`)
    console.log(`topPerformer: ${report.topPerformer}`)
    console.log(`needsAttention: ${report.needsAttention.join(', ') || '(none)'}`)
    console.log(`agents (${report.records.length}):`)
    for (const r of report.records) {
      console.log(`  ${r.agentCode.padEnd(12)} ${String(r.score).padStart(5)}  ${r.grade}  improve=[${r.improvementAreas.join(',')}]`)
    }
    if (jsonPath) console.log(`JSON dump: ${jsonPath}`)

    const firstCode = report.records[0]?.agentCode
    if (firstCode) {
      const history = await loadPerformanceHistory(prisma, firstCode, 20)
      console.log(`\nHistory for ${firstCode} (${history.length} points):`)
      for (const h of history) {
        console.log(`  ${h.reviewedAt.slice(0, 19)}  ${h.score}  ${h.grade}  ${h.version}`)
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
