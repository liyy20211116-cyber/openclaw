import { approvalService } from './approvalService'
import { auditService } from './auditService'
import { businessLineService } from './businessLineService'
import { ledgerService } from './ledgerService'
import { revenueService } from './revenueService'
import { taskService } from './taskService'
import { treasuryService } from './treasuryService'

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
      reinvestableAmount: Math.max(0, profitSummary.netProfit * 0.6),
    }
  },
}
