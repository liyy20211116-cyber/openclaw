/**
 * ChatGPT Plus Bridge Server
 * 
 * Uses your ChatGPT session access token with OpenAI's standard API.
 * The token's audience is api.openai.com, so it works as a Bearer token.
 * 
 * No API key payment needed — uses your existing Plus subscription.
 */

import { createServer } from 'node:http'
import { request as httpsRequest } from 'node:https'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true })

const PORT = Number(process.env.CHATGPT_BRIDGE_PORT ?? 18783)
const ACCESS_TOKEN = (process.env.CHATGPT_ACCESS_TOKEN ?? '').trim()

if (!ACCESS_TOKEN) {
  console.error('Missing CHATGPT_ACCESS_TOKEN in .env')
  console.error('Steps to get your token:')
  console.error('  1. Login to https://chatgpt.com')
  console.error('  2. Visit https://chatgpt.com/api/auth/session')
  console.error('  3. Copy the "accessToken" value')
  console.error('  4. Add CHATGPT_ACCESS_TOKEN=<token> to .env')
  process.exit(1)
}

function getTokenExpiry(): Date | null {
  try {
    const parts = ACCESS_TOKEN.split('.')
    if (parts.length < 2) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    return payload.exp ? new Date(payload.exp * 1000) : null
  } catch {
    return null
  }
}

function proxyToOpenAI(
  body: string,
  callback: (err: Error | null, statusCode: number, responseBody: string) => void,
) {
  const req = httpsRequest({
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Length': Buffer.byteLength(body),
    },
    timeout: 60000,
  }, (res) => {
    let data = ''
    res.on('data', (chunk: Buffer) => { data += chunk.toString() })
    res.on('end', () => {
      callback(null, res.statusCode ?? 500, data)
    })
  })

  req.on('error', (err) => callback(err, 0, ''))
  req.on('timeout', () => {
    req.destroy()
    callback(new Error('OpenAI request timeout'), 0, '')
  })
  req.write(body)
  req.end()
}

const server = createServer(async (req, res) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  }

  const sendJson = (statusCode: number, data: unknown) => {
    const body = JSON.stringify(data)
    res.writeHead(statusCode, { ...headers, 'Content-Length': String(Buffer.byteLength(body)) })
    res.end(body)
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers)
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    const exp = getTokenExpiry()
    sendJson(200, {
      ok: true,
      service: 'chatgpt-bridge',
      port: PORT,
      tokenExpiry: exp?.toISOString(),
      tokenValid: exp ? exp.getTime() > Date.now() : false,
    })
    return
  }

  if (req.method === 'GET' && req.url === '/v1/models') {
    sendJson(200, {
      object: 'list',
      data: [
        { id: 'gpt-4o', object: 'model', owned_by: 'chatgpt-plus' },
        { id: 'gpt-4o-mini', object: 'model', owned_by: 'chatgpt-plus' },
        { id: 'o4-mini', object: 'model', owned_by: 'chatgpt-plus' },
      ],
    })
    return
  }

  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const rawBody = Buffer.concat(chunks).toString('utf8')

    try {
      const parsed = JSON.parse(rawBody)
      const model = parsed.model ?? 'gpt-4o-mini'
      console.log(`[Bridge] → OpenAI API: model=${model}, msgs=${parsed.messages?.length ?? 0}`)

      proxyToOpenAI(
        JSON.stringify({ ...parsed, model }),
        (err, statusCode, responseBody) => {
          if (err) {
            console.error(`[Bridge] Error: ${err.message}`)
            sendJson(502, { error: { message: err.message, type: 'bridge_error' } })
            return
          }

          if (statusCode >= 200 && statusCode < 300) {
            try {
              const data = JSON.parse(responseBody)
              const content = data?.choices?.[0]?.message?.content ?? ''
              console.log(`[Bridge] ← OK: ${content.slice(0, 60)}...`)
              data.model_provider = 'chatgpt-plus'
              data.model_display = `ChatGPT Plus (${data.model ?? model})`
              res.writeHead(statusCode, headers)
              res.end(JSON.stringify(data))
            } catch {
              res.writeHead(statusCode, headers)
              res.end(responseBody)
            }
          } else {
            console.error(`[Bridge] ← ${statusCode}: ${responseBody.slice(0, 200)}`)
            res.writeHead(statusCode, headers)
            res.end(responseBody)
          }
        },
      )
    } catch {
      sendJson(400, { error: { message: 'Invalid JSON body', type: 'invalid_request' } })
    }
    return
  }

  sendJson(404, { error: 'Not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  const exp = getTokenExpiry()
  console.log(`[ChatGPT Bridge] Listening on http://127.0.0.1:${PORT}`)
  console.log(`[ChatGPT Bridge] Token: ${ACCESS_TOKEN.slice(0, 30)}...`)
  console.log(`[ChatGPT Bridge] Token expires: ${exp?.toISOString() ?? 'unknown'}`)
  console.log(`[ChatGPT Bridge] Proxying to: https://api.openai.com/v1`)
  console.log('[ChatGPT Bridge] Ready')
})
