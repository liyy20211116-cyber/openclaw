import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../../src/generated/prisma/client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../..')
const databasePath = path.resolve(projectRoot, 'dev.db')

export function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: `file:${databasePath}` })
  return new PrismaClient({ adapter })
}

export { databasePath, projectRoot }
