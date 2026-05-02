import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
// @ts-expect-error no types
import toIco from 'to-ico'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const svgPath = path.resolve(projectRoot, 'build', 'icon.svg')
const pngPath = path.resolve(projectRoot, 'build', 'icon.png')
const icoPath = path.resolve(projectRoot, 'build', 'icon.ico')

const sizes = [16, 32, 48, 64, 128, 256]

async function main() {
  const svgBuffer = fs.readFileSync(svgPath)

  const pngBuffers = await Promise.all(
    sizes.map(size =>
      sharp(svgBuffer).resize(size, size).png().toBuffer()
    )
  )

  await sharp(svgBuffer).resize(256, 256).png().toFile(pngPath)
  console.log(`PNG: ${pngPath}`)

  const icoBuffer = await toIco(pngBuffers)
  fs.writeFileSync(icoPath, icoBuffer)
  console.log(`ICO: ${icoPath}`)
}

main().catch(err => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
