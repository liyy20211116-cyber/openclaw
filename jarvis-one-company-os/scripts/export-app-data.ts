import 'dotenv/config'
import { createPrismaClient } from './lib/prismaClient'
import { exportSnapshot } from './lib/exportSnapshot'

const prisma = createPrismaClient()

async function main() {
  const outputPath = await exportSnapshot(prisma)
  console.log(`App snapshot written to ${outputPath}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
