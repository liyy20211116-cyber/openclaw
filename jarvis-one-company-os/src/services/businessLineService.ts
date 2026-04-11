import { getSnapshot } from '../lib/snapshotStore'
import type { BusinessLine, BusinessLineProfit, ProfitSummary } from '../types'

const defaultBusinessLines: BusinessLine[] = [
  {
    id: 'bl_ai_automation',
    name: 'AI 自动化搭建服务',
    description: '为中小企业搭建 AI 工作流自动化系统，包含需求分析、流程设计、系统交付和培训。',
    status: 'active',
    pricingTiers: [
      { name: '基础版', price: 2999, description: '单流程自动化 + 7天交付' },
      { name: '标准版', price: 5999, description: '3个流程 + 数据看板 + 14天交付' },
      { name: '高级版', price: 12999, description: '全链路自动化 + 定制集成 + 30天交付' },
    ],
    costStructure: [
      { label: '模型调用成本', tokenCost: 800, fiatCost: 120 },
      { label: '搜索与调研成本', tokenCost: 300, fiatCost: 45 },
      { label: '部署与测试', tokenCost: 500, fiatCost: 80 },
    ],
    targetCustomers: '中小企业主、个体创业者、运营团队负责人',
    createdAt: '2026-04-09',
  },
  {
    id: 'bl_content_ops',
    name: 'AI 内容代运营',
    description: '利用 AI 生成短视频脚本、图文内容和社交媒体排期，按周交付内容包。',
    status: 'active',
    pricingTiers: [
      { name: '入门版', price: 899, description: '周产 5 条内容 + 排期建议' },
      { name: '成长版', price: 1999, description: '周产 15 条 + 封面设计 + 数据复盘' },
      { name: '爆发版', price: 4999, description: '每日内容 + 投放建议 + 专属策略' },
    ],
    costStructure: [
      { label: '内容生成模型', tokenCost: 600, fiatCost: 90 },
      { label: '图片/视觉生成', tokenCost: 500, fiatCost: 75 },
      { label: '分发与追踪', tokenCost: 200, fiatCost: 30 },
    ],
    targetCustomers: '自媒体人、品牌方、MCN 机构',
    createdAt: '2026-04-09',
  },
  {
    id: 'bl_system_integration',
    name: 'AI 系统集成顾问',
    description: '为企业评估现有系统，设计 AI 集成方案，完成技术对接和验收。',
    status: 'planning',
    pricingTiers: [
      { name: '诊断报告', price: 1999, description: '系统评估 + AI 融合路线图' },
      { name: '集成实施', price: 8999, description: '完整集成 + 3个月运维支持' },
    ],
    costStructure: [
      { label: '架构设计', tokenCost: 1200, fiatCost: 180 },
      { label: '代码开发', tokenCost: 1500, fiatCost: 225 },
      { label: '测试与部署', tokenCost: 800, fiatCost: 120 },
    ],
    targetCustomers: '传统企业 IT 部门、数字化转型团队',
    createdAt: '2026-04-09',
  },
]

export const businessLineService = {
  getAll(): BusinessLine[] {
    const snapshot = getSnapshot()
    return snapshot.businessLines?.length ? snapshot.businessLines : defaultBusinessLines
  },

  getActive(): BusinessLine[] {
    return this.getAll().filter((bl) => bl.status === 'active')
  },

  getById(id: string): BusinessLine | undefined {
    return this.getAll().find((bl) => bl.id === id)
  },

  getProfitSummary(): ProfitSummary {
    const snapshot = getSnapshot()
    const revenues = snapshot.revenues
    const tasks = snapshot.tasks
    const ledger = snapshot.ledger

    const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0)

    const totalCostToken = Math.abs(
      ledger
        .filter((l) => l.amount < 0)
        .reduce((sum, l) => sum + l.amount, 0),
    )

    const tokenToFiatRate = 0.15
    const totalCostFiat = totalCostToken * tokenToFiatRate
    const netProfit = totalRevenue - totalCostFiat
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    const roiPercent = totalCostFiat > 0 ? (netProfit / totalCostFiat) * 100 : 0

    const blMap = new Map<string, BusinessLineProfit>()

    for (const rev of revenues) {
      const key = rev.businessLine || '未分类'
      if (!blMap.has(key)) {
        blMap.set(key, {
          businessLine: key,
          revenue: 0,
          costToken: 0,
          costFiat: 0,
          profit: 0,
          margin: 0,
          taskCount: 0,
          completedTasks: 0,
        })
      }
      const entry = blMap.get(key)!
      entry.revenue += rev.amount
      entry.costToken += rev.tokenMapped
    }

    for (const task of tasks) {
      const _taskType = task.taskType || 'ops'
      void _taskType
      let blKey: string | undefined

      for (const rev of revenues) {
        if (rev.sourceTask === task.title) {
          blKey = rev.businessLine
          break
        }
      }

      if (!blKey) {
        const candidates = [...blMap.keys()]
        blKey = candidates[0] || '未分类'
      }

      if (!blMap.has(blKey)) {
        blMap.set(blKey, {
          businessLine: blKey,
          revenue: 0,
          costToken: 0,
          costFiat: 0,
          profit: 0,
          margin: 0,
          taskCount: 0,
          completedTasks: 0,
        })
      }

      const entry = blMap.get(blKey)!
      entry.taskCount++
      entry.costToken += task.spentToken
      if (task.status === 'completed') {
        entry.completedTasks++
      }
    }

    const businessLineBreakdown = [...blMap.values()].map((entry) => {
      entry.costFiat = entry.costToken * tokenToFiatRate
      entry.profit = entry.revenue - entry.costFiat
      entry.margin = entry.revenue > 0 ? (entry.profit / entry.revenue) * 100 : 0
      return entry
    })

    return {
      totalRevenue,
      totalCostFiat,
      totalCostToken,
      netProfit,
      profitMargin,
      roiPercent,
      businessLineBreakdown,
    }
  },
}
