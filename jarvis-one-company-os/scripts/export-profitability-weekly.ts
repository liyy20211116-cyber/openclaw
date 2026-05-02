import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { AppSnapshot } from '../src/types'
import { buildProfitabilityWeeklyReport } from '../src/services/profitabilityService'
import { buildAppSnapshot } from './lib/exportSnapshot'
import { createPrismaClient, projectRoot } from './lib/prismaClient'

async function main() {
  const prisma = createPrismaClient()
  try {
    const snapshot = await buildAppSnapshot(prisma) as AppSnapshot
    const now = new Date()
    const report = buildProfitabilityWeeklyReport(snapshot, snapshot.businessLines, now)
    const fileName = `profitability-weekly-${now.toISOString().slice(0, 10)}.md`
    const outputPath = path.resolve(projectRoot, '..', 'docs', fileName)

    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, `${report}\n`, 'utf8')

    console.log(`Profitability weekly report written to ${outputPath}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
