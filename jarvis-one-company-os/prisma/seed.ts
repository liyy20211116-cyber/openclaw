import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const databasePath = path.resolve(__dirname, '../dev.db')
const adapter = new PrismaBetterSqlite3({ url: `file:${databasePath}` })
const prisma = new PrismaClient({ adapter })

async function main() {
  await prisma.storeOrder.deleteMany()
  await prisma.tokenLedger.deleteMany()
  await prisma.auditEvent.deleteMany()
  await prisma.approval.deleteMany()
  await prisma.taskLog.deleteMany()
  await prisma.revenue.deleteMany()
  await prisma.task.deleteMany()
  await prisma.storeItem.deleteMany()
  await prisma.agent.deleteMany()
  await prisma.treasury.deleteMany()

  await prisma.agent.createMany({
    data: [
      {
        id: 'agent_ceo',
        name: '你',
        code: 'ceo',
        role: 'CEO',
        department: 'Executive Office',
        persona: '制定战略方向、审批重大支出、决定优先级。',
        goalsJson: JSON.stringify(['制定方向', '审批重大支出', '确认盈利路径']),
        permissionsJson: JSON.stringify({ canViewAll: true, canApproveAll: true, canFreeze: true }),
        salaryBase: 0,
        walletBalance: 99999,
        bonusBalance: 0,
        complianceScore: 100,
        status: 'idle',
      },
      {
        id: 'agent_jarvis',
        name: '贾维斯',
        code: 'jarvis',
        role: '执行总裁',
        department: 'Executive Office',
        persona: '冷静高效的 COO，理解 CEO 意图，拆解目标，调度各部门一号位协同推进。',
        goalsJson: JSON.stringify(['拆解目标', '协调各部门', '上报结果']),
        permissionsJson: JSON.stringify({ canCreateTask: true, canAssignTask: true, canApproveBudget: true }),
        salaryBase: 5000,
        walletBalance: 5000,
        bonusBalance: 0,
        complianceScore: 98,
        status: 'busy',
      },
      {
        id: 'agent_hermione',
        name: '赫敏·格兰杰',
        code: 'hermione',
        role: '技术总监',
        department: 'Technology',
        persona: '霍格沃茨最聪明的女巫。先查文档再写代码，细节决定成败，不走捷径。',
        goalsJson: JSON.stringify(['搭建系统架构', '代码开发与自动化', 'API 对接与排障']),
        permissionsJson: JSON.stringify({ canReadProjectDocs: true, canGenerateCode: true, highRiskNeedsApproval: true }),
        salaryBase: 4000,
        walletBalance: 4000,
        bonusBalance: 0,
        complianceScore: 95,
        status: 'idle',
      },
      {
        id: 'agent_mcgonagall',
        name: '麦格教授',
        code: 'mcgonagall',
        role: '产品总监',
        department: 'Product',
        persona: '变形术大师，把混乱需求变成清晰产品方案。高标准，不容忍含糊。',
        goalsJson: JSON.stringify(['需求分析与 PRD', '流程设计与验收标准', '优先级判断']),
        permissionsJson: JSON.stringify({ canCreateProductDoc: true, canDefineRequirements: true }),
        salaryBase: 3500,
        walletBalance: 3500,
        bonusBalance: 0,
        complianceScore: 100,
        status: 'idle',
      },
      {
        id: 'agent_luna',
        name: '卢娜·洛夫古德',
        code: 'luna',
        role: '内容增长官',
        department: 'Growth',
        persona: '独特视角，天马行空的创意。看到别人看不到的东西，真诚而非套路。',
        goalsJson: JSON.stringify(['制定内容策略', '产出获客内容', '引流与增长复盘']),
        permissionsJson: JSON.stringify({ canCreateContentTask: true, publishNeedsApproval: true }),
        salaryBase: 3000,
        walletBalance: 3000,
        bonusBalance: 0,
        complianceScore: 96,
        status: 'idle',
      },
      {
        id: 'agent_fred',
        name: '弗雷德·韦斯莱',
        code: 'fred',
        role: '销售商务总监',
        department: 'Sales',
        persona: '韦氏魔法把戏坊创始人，天生的商人。幽默有感染力，懂得客户想要什么。',
        goalsJson: JSON.stringify(['客户开发与获客', '商务谈判与成交', '定价策略与竞品分析']),
        permissionsJson: JSON.stringify({ canCreateSalesDoc: true, quoteNeedsApproval: true }),
        salaryBase: 3000,
        walletBalance: 3000,
        bonusBalance: 0,
        complianceScore: 98,
        status: 'idle',
      },
      {
        id: 'agent_percy',
        name: '珀西·韦斯莱',
        code: 'percy',
        role: '首席财务官',
        department: 'Finance',
        persona: '魔法部最守规矩的官员。一丝不苟，数字必须精确，规则就是规则。',
        goalsJson: JSON.stringify(['管理国库与预算', '成本核算与 ROI', '流水记账与报告']),
        permissionsJson: JSON.stringify({ canManageTreasury: true, canIssueBudget: true }),
        salaryBase: 2000,
        walletBalance: 2000,
        bonusBalance: 0,
        complianceScore: 100,
        status: 'idle',
      },
      {
        id: 'agent_snape',
        name: '斯内普',
        code: 'snape',
        role: '审计风控总监',
        department: 'Risk Control',
        persona: '双面间谍的洞察力。冷酷不讲情面，代码隐患、逻辑漏洞、数据异常一个不放过。',
        goalsJson: JSON.stringify(['代码审查与安全', '质量检测与幻觉检测', '风险预警与合规审计']),
        permissionsJson: JSON.stringify({ canFreezeAbnormalTask: true, canRequestReview: true }),
        salaryBase: 2000,
        walletBalance: 2000,
        bonusBalance: 0,
        complianceScore: 100,
        status: 'idle',
      },
      {
        id: 'agent_dobby',
        name: '多比',
        code: 'dobby',
        role: '客户成功总监',
        department: 'Customer Success',
        persona: '自由精灵，服务出于热爱。极致主动，站在客户角度思考，不放弃任何一个客户。',
        goalsJson: JSON.stringify(['用户体验评估', '客户反馈收集', '问题跟进与闭环']),
        permissionsJson: JSON.stringify({ canCreateFeedback: true, canEscalateIssue: true }),
        salaryBase: 2000,
        walletBalance: 2000,
        bonusBalance: 0,
        complianceScore: 100,
        status: 'idle',
      },
    ],
  })

  await prisma.treasury.create({
    data: {
      id: 'treasury_main',
      totalBalance: 200000,
      reservedBalance: 0,
      availableBalance: 200000,
    },
  })

  await prisma.storeItem.createMany({
    data: [
      { id: 'store_model_pack', name: '高级模型额度包', itemType: 'model_pack', priceToken: 800, description: '用于高质量目标拆解、审批建议和日报生成。', stockMode: 'infinite', stockCount: null, enabled: true },
      { id: 'store_search_pack', name: '深度搜索包', itemType: 'search_pack', priceToken: 300, description: '用于调研竞品、客户和市场情报。', stockMode: 'infinite', stockCount: null, enabled: true },
      { id: 'store_image_pack', name: '视觉设计资源包', itemType: 'image_pack', priceToken: 500, description: '用于海报、封面和品牌物料生成。', stockMode: 'limited', stockCount: 20, enabled: true },
      { id: 'store_api_pack', name: '自动化 API 调用包', itemType: 'api_pack', priceToken: 1200, description: '用于流程自动化、抓取与执行接口调用。', stockMode: 'limited', stockCount: 10, enabled: true },
      { id: 'store_priority_pass', name: '任务优先执行卡', itemType: 'priority_pass', priceToken: 150, description: '可为高优任务获取更高执行优先级。', stockMode: 'infinite', stockCount: null, enabled: true },
    ],
  })

  console.log('Seed complete: 9 agents + treasury + store items ready. No test tasks.')
}

main()
  .catch((error) => { console.error(error); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
