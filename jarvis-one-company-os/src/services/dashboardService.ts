import { approvalService } from './approvalService'
import { auditService } from './auditService'
import { businessLineService } from './businessLineService'
import { ledgerService } from './ledgerService'
import { revenueService } from './revenueService'
import { taskService } from './taskService'
import { treasuryService } from './treasuryService'
import { getCachedConfig } from './configService'
import type { LlmUsageSummary } from '../types'

export async function fetchLlmUsageSummary(): Promise<LlmUsageSummary> {
  try {
    const res = await fetch('/api/llm/usage-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) throw new Error('fetch failed')
    return (await res.json()) as LlmUsageSummary
  } catch {
    return {
      todayCost: 0, todayTokens: 0, todayCalls: 0,
      weeklyCost: 0, weeklyTokens: 0, weeklyCalls: 0,
      costByAgent: [], recentLogs: [],
    }
  }
}

export const dashboardService = {
  getOverview() {
    const tasks = taskService.getAll()
    const approvals = approvalService.getAll()
    const treasury = treasuryService.getTreasury()
    const profitSummary = businessLineService.getProfitSummary()
    const activeBusinessLines = businessLineService.getActive()

    return {
      activeTasks: taskService.getActiveCount(),
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === 'completed').length,
      frozenTasks: tasks.filter((t) => t.status === 'frozen').length,
      pendingApprovals: approvals.filter((item) => item.status === 'pending').length,
      weeklyRevenue: revenueService.getTotalRevenue(),
      weeklySpend: ledgerService.getWeeklySpend(),
      treasuryBalance: treasury.availableBalance,
      openAuditEvents: auditService.getOpenCount(),
      netProfit: profitSummary.netProfit,
      profitMargin: profitSummary.profitMargin,
      roiPercent: profitSummary.roiPercent,
      activeBusinessLines: activeBusinessLines.length,
      totalBusinessLines: businessLineService.getAll().length,
      reinvestableAmount: Math.max(0, profitSummary.netProfit * ((getCachedConfig()?.token_economy?.profit_distribution?.token_infrastructure_percent ?? 60) / 100)),
    }
  },
}
