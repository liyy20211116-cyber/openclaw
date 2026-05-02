import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { AppSnapshot } from '../src/types'
import type { AppConfig } from '../src/services/configService'
import { buildCommercialReadinessReport } from '../src/services/commercialReadinessReportService'
import { buildAppSnapshot } from './lib/exportSnapshot'
import { createPrismaClient, projectRoot } from './lib/prismaClient'
import { dataRoot } from './lib/performanceLoader'

async function loadAppConfigFromDisk(): Promise<AppConfig | null> {
  const configPath = path.resolve(dataRoot(), 'config', 'app-config.json')
  try {
    const raw = await fs.readFile(configPath, 'utf8')
    return JSON.parse(raw) as AppConfig
  } catch (err) {
    console.warn(`[export-commercial-readiness] Failed to load ${configPath}:`, err)
    return null
  }
}

async function main() {
  const prisma = createPrismaClient()
  try {
    const snapshot = (await buildAppSnapshot(prisma)) as AppSnapshot
    const config = await loadAppConfigFromDisk()
    const now = new Date()
    const { summary, markdown } = buildCommercialReadinessReport(
      snapshot,
      config,
      snapshot.businessLines,
      now,
    )

    const fileName = `commercial-readiness-${now.toISOString().slice(0, 10)}.md`
    const outputPath = path.resolve(projectRoot, '..', 'docs', fileName)

    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, `${markdown}\n`, 'utf8')

    console.log(`Commercial readiness report written to ${outputPath}`)
    console.log(`Score: ${summary.companyReadinessScore.toFixed(1)} / 100  Grade: ${summary.companyReadinessGrade}`)
    console.log(`Team count: ${summary.teamCount}, Top performer: ${summary.topPerformer || '(n/a)'}`)
    console.log(`Milestones reached: ${(Object.entries(summary.milestones) as Array<[string, { reached: boolean }]>)
      .filter(([, value]) => value.reached)
      .map(([key]) => key)
      .join(', ') || '(none)'}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
