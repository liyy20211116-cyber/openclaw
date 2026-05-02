type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL: LogLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) ?? 'info'

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL]
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 23)
}

function format(level: LogLevel, module: string, msg: string): string {
  return `[${timestamp()}][${level.toUpperCase()}][${module}] ${msg}`
}

export function createLogger(module: string) {
  return {
    debug(msg: string, ...args: unknown[]) {
      if (shouldLog('debug')) console.debug(format('debug', module, msg), ...args)
    },
    info(msg: string, ...args: unknown[]) {
      if (shouldLog('info')) console.info(format('info', module, msg), ...args)
    },
    warn(msg: string, ...args: unknown[]) {
      if (shouldLog('warn')) console.warn(format('warn', module, msg), ...args)
    },
    error(msg: string, ...args: unknown[]) {
      if (shouldLog('error')) console.error(format('error', module, msg), ...args)
    },
  }
}
