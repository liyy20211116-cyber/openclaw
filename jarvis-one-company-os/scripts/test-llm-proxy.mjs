import http from 'node:http'

const data = JSON.stringify({
  model: 'qwen2.5:7b',
  messages: [
    { role: 'system', content: '你是贾维斯，一人公司的执行总裁（COO）。简洁有力，不说废话。用中文回复。' },
    { role: 'user', content: 'CEO给出了目标：ONES需求审核自动化项目还有缺口没闭环，安排相关部门协作把它做完。请用2句话概括你的理解，然后列出需要召集哪些部门。' },
  ],
  temperature: 0.7,
  max_tokens: 500,
})

const req = http.request(
  {
    hostname: '127.0.0.1',
    port: 18782,
    path: '/api/llm/chat',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    timeout: 120000,
  },
  (res) => {
    let body = ''
    res.on('data', (c) => { body += c })
    res.on('end', () => {
      try {
        const j = JSON.parse(body)
        console.log('STATUS:', res.statusCode)
        console.log('JARVIS:', j.choices?.[0]?.message?.content)
      } catch {
        console.log('RAW:', body.substring(0, 800))
      }
    })
  },
)
req.on('error', (e) => console.error('ERR:', e.message))
req.on('timeout', () => { req.destroy(); console.error('TIMEOUT') })
req.write(data)
req.end()
