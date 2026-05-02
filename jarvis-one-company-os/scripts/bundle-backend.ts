import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const outDir = path.resolve(projectRoot, 'dist-backend')

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true })
}
fs.mkdirSync(outDir, { recursive: true })

const scriptEntries = [
  'scripts/writeback-api.ts',
  'scripts/create-task.ts',
  'scripts/decide-approval.ts',
  'scripts/purchase-store-item.ts',
  'scripts/pay-salary.ts',
  'scripts/add-revenue.ts',
  'scripts/update-task-status.ts',
  'scripts/update-audit.ts',
  'scripts/execute-task-openclaw.ts',
  'scripts/audit-inspection.ts',
  'scripts/export-app-data.ts',
].filter(s => fs.existsSync(path.resolve(projectRoot, s)))

async function main() {
  for (const entry of scriptEntries) {
    const outFile = path.join(outDir, path.basename(entry).replace('.ts', '.js'))
    await build({
      entryPoints: [path.resolve(projectRoot, entry)],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'esm',
      outfile: outFile,
      external: [
        'better-sqlite3',
        '@prisma/client',
        '@prisma/adapter-better-sqlite3',
        'electron',
      ],
      banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
      sourcemap: false,
      minify: false,
    })
    console.log(`  bundled: ${entry} -> ${path.relative(projectRoot, outFile)}`)
  }

  const envSrc = path.resolve(projectRoot, '.env')
  if (fs.existsSync(envSrc)) {
    fs.copyFileSync(envSrc, path.join(outDir, '.env'))
    console.log('  copied: .env -> dist-backend/.env')
  }

  const configSrc = path.resolve(projectRoot, 'config')
  const configDst = path.join(outDir, 'config')
  if (fs.existsSync(configSrc)) {
    if (!fs.existsSync(configDst)) fs.mkdirSync(configDst, { recursive: true })
    for (const f of fs.readdirSync(configSrc)) {
      if (f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml')) {
        fs.copyFileSync(path.join(configSrc, f), path.join(configDst, f))
        console.log(`  copied: config/${f}`)
      }
    }
  }

  console.log(`\nBackend bundled to ${path.relative(projectRoot, outDir)}/`)
}

main().catch(err => {
  console.error('Bundle failed:', err)
  process.exit(1)
})
