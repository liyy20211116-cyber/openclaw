import process from 'node:process'

function normalizeValue(value: string) {
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  return value
}

export function parseCliInput<T>() {
  const raw = process.argv[2]

  if (raw?.trim().startsWith('{')) {
    return JSON.parse(raw) as T
  }

  const pairs = process.argv.slice(2)
  if (pairs.length === 0) {
    throw new Error('Missing payload. Use JSON or key=value arguments.')
  }

  const result: Record<string, unknown> = {}
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf('=')
    if (separatorIndex === -1) {
      throw new Error(`Invalid argument: ${pair}. Expected key=value.`)
    }

    const key = pair.slice(0, separatorIndex)
    const value = pair.slice(separatorIndex + 1)
    result[key] = normalizeValue(value)
  }

  return result as T
}
