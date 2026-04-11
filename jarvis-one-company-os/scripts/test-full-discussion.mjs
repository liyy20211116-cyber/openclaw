import http from 'node:http'

const MODEL = 'qwen2.5:7b'
const API_PORT = 18782

function llmCall(messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ model: MODEL, messages, temperature: 0.7, max_tokens: 800 })
    const req = http.request(
      {
        hostname: '127.0.0.1', port: API_PORT, path: '/api/llm/chat', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        timeout: 180000,
      },
      (res) => {
        let body = ''
        res.on('data', (c) => { body += c })
        res.on('end', () => {
          try {
            const j = JSON.parse(body)
            if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 300)}`)); return }
            resolve(j.choices?.[0]?.message?.content?.trim() ?? '')
          } catch { reject(new Error(`Parse error: ${body.substring(0, 300)}`)) }
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(data)
    req.end()
  })
}

const personas = {
  jarvis: { name: '贾维斯', emoji: '🎯', role: 'COO', prompt: '你是贾维斯，一人公司的执行总裁。简洁有力，不说废话。' },
  hermione: { name: '赫敏', emoji: '📚', role: 'CTO', prompt: '你是赫敏·格兰杰，技术部一号位。极度严谨，先查文档再动手。' },
  mcgonagall: { name: '麦格教授', emoji: '🔮', role: 'CPO', prompt: '你是麦格教授，产品部一号位。高标准严要求，善于把混乱想法变成清晰方案。' },
  snape: { name: '斯内普', emoji: '🧪', role: 'CAO', prompt: '你是斯内普，审计部一号位。冷酷不讲情面，一眼看穿风险和漏洞。' },
}

async function main() {
  const goal = 'ONES需求审核自动化项目还有缺口没闭环，安排相关部门协作把它做完。'
  const discussion = []

  console.log('=== 一人公司团队讨论会 ===\n')
  console.log(`📋 CEO 目标：${goal}\n`)

  // Jarvis 分析
  console.log('🎯 贾维斯正在分析...')
  const t0 = Date.now()
  const jarvisReply = await llmCall([
    { role: 'system', content: personas.jarvis.prompt },
    { role: 'user', content: `CEO给出目标："${goal}"\n\n用2-3句话概括理解，列出需要召集的部门，提出初步拆解思路。用自然对话语气，控制在200字以内。` },
  ])
  console.log(`🎯 贾维斯（${((Date.now()-t0)/1000).toFixed(1)}s）：\n${jarvisReply}\n`)
  discussion.push({ agent: '贾维斯', content: jarvisReply })

  // 赫敏发言
  console.log('📚 赫敏正在思考...')
  const t1 = Date.now()
  const hermioneReply = await llmCall([
    { role: 'system', content: personas.hermione.prompt },
    { role: 'user', content: `团队讨论会。CEO目标："${goal}"\n贾维斯说：${jarvisReply}\n\n从技术角度发言，控制在150字以内。` },
  ])
  console.log(`📚 赫敏（${((Date.now()-t1)/1000).toFixed(1)}s）：\n${hermioneReply}\n`)
  discussion.push({ agent: '赫敏', content: hermioneReply })

  // 麦格教授发言
  console.log('🔮 麦格教授正在思考...')
  const t2 = Date.now()
  const mcgReply = await llmCall([
    { role: 'system', content: personas.mcgonagall.prompt },
    { role: 'user', content: `团队讨论会。CEO目标："${goal}"\n贾维斯说：${jarvisReply}\n赫敏说：${hermioneReply}\n\n从产品角度发言，控制在150字以内。` },
  ])
  console.log(`🔮 麦格教授（${((Date.now()-t2)/1000).toFixed(1)}s）：\n${mcgReply}\n`)
  discussion.push({ agent: '麦格教授', content: mcgReply })

  // 斯内普发言
  console.log('🧪 斯内普正在审视...')
  const t3 = Date.now()
  const snapeReply = await llmCall([
    { role: 'system', content: personas.snape.prompt },
    { role: 'user', content: `团队讨论会。CEO目标："${goal}"\n贾维斯说：${jarvisReply}\n赫敏说：${hermioneReply}\n麦格教授说：${mcgReply}\n\n从审计风控角度发言，找出风险和漏洞，控制在150字以内。` },
  ])
  console.log(`🧪 斯内普（${((Date.now()-t3)/1000).toFixed(1)}s）：\n${snapeReply}\n`)
  discussion.push({ agent: '斯内普', content: snapeReply })

  // Jarvis 总结任务
  console.log('🎯 贾维斯正在制定任务分配方案...')
  const t4 = Date.now()
  const summaryContext = discussion.map(d => `${d.agent}：${d.content}`).join('\n\n')
  const taskPlan = await llmCall([
    { role: 'system', content: personas.jarvis.prompt },
    { role: 'user', content: `团队讨论结束。各部门发言：\n\n${summaryContext}\n\n请综合所有意见，输出最终任务分配方案。每个任务用一行：[负责人] 任务标题 | 简述 | 优先级 | 预算Token\n只输出任务列表。` },
  ])
  console.log(`📋 最终任务方案（${((Date.now()-t4)/1000).toFixed(1)}s）：\n${taskPlan}\n`)

  console.log('=== 讨论结束 ===')
  console.log(`总耗时：${((Date.now()-t0)/1000).toFixed(1)}s`)
  console.log('✅ 全流程测试通过！')
}

main().catch(console.error)
