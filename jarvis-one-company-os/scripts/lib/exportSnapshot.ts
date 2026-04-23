import fs from 'node:fs/promises'
import path from 'node:path'
import { PrismaClient } from '../../src/generated/prisma/client'
import { projectRoot } from './prismaClient'
import { loadLatestPerformanceWithPrisma } from './performanceLoader'

const outputPath = path.resolve(projectRoot, 'src/data/appSnapshot.ts')
const publicOutputPath = path.resolve(projectRoot, 'public/appSnapshot.json')

function formatDate(value: Date | null | undefined) {
  if (!value) return ''
  return value.toISOString().slice(0, 10)
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return ''
  return value.toISOString().slice(0, 16).replace('T', ' ')
}

function humanizeIssueType(issueType: string) {
  const map: Record<string, string> = {
    hallucination: '幻觉风险',
    overspend: '超预算风险',
    unauthorized: '越权执行',
    low_quality: '低质量交付',
    duplicate: '重复执行',
  }

  return map[issueType] ?? issueType
}

function safeParseDetail(detailJson: string) {
  try {
    return JSON.parse(detailJson) as Record<string, unknown>
  } catch {
    return {}
  }
}

function humanizeAction(actionType: string) {
  const map: Record<string, string> = {
    create: '首次提交任务',
    assign: '修正后再次提交',
    approve: '审批通过',
    reject: '审批驳回',
  }

  return map[actionType] ?? actionType
}

export async function exportSnapshot(prisma: PrismaClient) {
  const [agents, tasks, approvals, ledger, revenues, auditEvents, taskLogs, storeItems, storeOrders, treasuryRecord, performance] = await Promise.all([
    prisma.agent.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.task.findMany({ include: { owner: true }, orderBy: { createdAt: 'asc' } }),
    prisma.approval.findMany({ include: { requester: true, approver: true }, orderBy: { createdAt: 'asc' } }),
    prisma.tokenLedger.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.revenue.findMany({ include: { relatedTask: true }, orderBy: { createdAt: 'asc' } }),
    prisma.auditEvent.findMany({ include: { agent: true, task: true }, orderBy: { createdAt: 'asc' } }),
    prisma.taskLog.findMany({ include: { operator: true }, orderBy: { createdAt: 'asc' } }),
    prisma.storeItem.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.storeOrder.findMany({ include: { buyer: true, item: true }, orderBy: { createdAt: 'asc' } }),
    prisma.treasury.findFirst(),
    loadLatestPerformanceWithPrisma(prisma).catch(() => null),
  ])

  const performanceByCode = new Map(
    (performance?.records ?? []).map((record) => [record.agentCode, record]),
  )

  const taskMap = new Map(tasks.map((task) => [task.id, task]))
  const taskCountByOwner = tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.ownerAgentId] = (acc[task.ownerAgentId] ?? 0) + 1
    return acc
  }, {})
  const logsByTaskId = taskLogs.reduce<Record<string, typeof taskLogs>>((acc, log) => {
    acc[log.taskId] = [...(acc[log.taskId] ?? []), log]
    return acc
  }, {})
  const approvalsByTaskId = approvals.reduce<Record<string, typeof approvals>>((acc, approval) => {
    acc[approval.targetId] = [...(acc[approval.targetId] ?? []), approval]
    return acc
  }, {})

  const snapshot = {
    agents: agents.map((agent) => {
      const perf = performanceByCode.get(agent.code)
      return {
        id: agent.code,
        name: agent.name,
        role: agent.role,
        department: agent.department,
        persona: agent.persona,
        status: agent.status,
        walletBalance: agent.walletBalance,
        currentTasks: taskCountByOwner[agent.id] ?? 0,
        complianceScore: agent.complianceScore,
        goals: JSON.parse(agent.goalsJson) as string[],
        performance: perf
          ? {
              score: perf.score,
              grade: perf.grade,
              breakdown: perf.breakdown,
              improvementAreas: perf.improvementAreas,
              reviewedAt: perf.reviewedAt,
              reviewer: perf.reviewer,
            }
          : undefined,
      }
    }),
    tasks: tasks.map((task) => {
      const logs = logsByTaskId[task.id] ?? []
      const taskApprovals = approvalsByTaskId[task.id] ?? []
      const resubmitLogs = logs.filter((log) => {
        const detail = safeParseDetail(log.detailJson)
        return detail.mode === 'resubmit'
      })
      const rejectionLogs = logs.filter((log) => log.actionType === 'reject')
      const latestRejectionLog = rejectionLogs.at(-1)
      const latestRejectionDetail = latestRejectionLog ? safeParseDetail(latestRejectionLog.detailJson) : {}

      let submissionIndex = 1
      const timeline = [...logs]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((log) => {
          const detail = safeParseDetail(log.detailJson)
          const isResubmission = detail.mode === 'resubmit'
          if (isResubmission) {
            submissionIndex += 1
          }

          return {
            id: log.id,
            type: log.actionType === 'create' ? 'created' : log.actionType === 'assign' ? 'resubmitted' : log.actionType,
            submissionIndex,
            actor: log.operator.name,
            note: typeof detail.decisionNote === 'string' && detail.decisionNote.length > 0
              ? detail.decisionNote
              : typeof detail.title === 'string' && detail.title.length > 0
                ? `${humanizeAction(log.actionType)}：${detail.title}`
                : humanizeAction(log.actionType),
            createdAt: formatDateTime(log.createdAt),
          }
        })

      const approvalTimeline = taskApprovals.map((approval) => {
        const approvalSubmissionIndex = Math.max(
          1,
          taskApprovals
            .filter((item) => item.createdAt.getTime() <= approval.createdAt.getTime())
            .length,
        )

        return {
          id: `${approval.id}_${approval.status}`,
          type: approval.status === 'pending' ? 'approval_requested' : approval.status,
          submissionIndex: approvalSubmissionIndex,
          actor: approval.approver.name,
          note: approval.status === 'pending'
            ? approval.reason
            : approval.decisionNote ?? humanizeAction(approval.status),
          createdAt: formatDateTime(approval.status === 'pending' ? approval.createdAt : approval.decidedAt ?? approval.createdAt),
        }
      })

      return {
        id: task.id,
        title: task.title,
        owner: task.owner.name,
        ownerAgentId: task.owner.code,
        description: task.description,
        taskType: task.taskType,
        priority: task.priority,
        status: task.status,
        budgetToken: task.budgetToken,
        spentToken: task.spentToken,
        dueAt: formatDate(task.dueAt),
        requiresApproval: task.requiresApproval,
        resubmissionCount: resubmitLogs.length,
        latestRejectionNote: typeof latestRejectionDetail.decisionNote === 'string' ? latestRejectionDetail.decisionNote : '',
        latestRejectionAt: latestRejectionLog ? formatDateTime(latestRejectionLog.createdAt) : '',
        timeline: [...timeline, ...approvalTimeline].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      }
    }),
    approvals: approvals.map((approval) => {
      const relatedTask = taskMap.get(approval.targetId)
      const amount = relatedTask?.budgetToken ?? 0
      const targetTitle = relatedTask?.title ?? `${approval.targetType}:${approval.targetId}`
      const taskLogsForApproval = logsByTaskId[approval.targetId] ?? []
      const resubmissionCount = taskLogsForApproval.filter((log) => {
        const detail = safeParseDetail(log.detailJson)
        return detail.mode === 'resubmit'
      }).length
      const latestRejectLog = taskLogsForApproval.filter((log) => log.actionType === 'reject').at(-1)
      const latestRejectDetail = latestRejectLog ? safeParseDetail(latestRejectLog.detailJson) : {}

      return {
        id: approval.id,
        requester: approval.requester.name,
        targetId: approval.targetId,
        targetTitle,
        amount,
        reason: approval.reason,
        status: approval.status,
        createdAt: formatDateTime(approval.createdAt),
        resubmissionCount,
        latestDecisionNote: approval.decisionNote ?? '',
        latestRejectionNote: typeof latestRejectDetail.decisionNote === 'string' ? latestRejectDetail.decisionNote : '',
      }
    }),
    ledger: ledger.map((item) => ({
      id: item.id,
      type: item.ledgerType === 'revenue_share' ? 'revenue_mapping' : item.ledgerType,
      actor: item.toAccount.replace('agent_', '').replaceAll('_', ' ') || item.toAccount,
      amount: item.ledgerType === 'salary' || item.ledgerType === 'budget' ? -item.amount : item.amount,
      note: item.reason,
      createdAt: formatDateTime(item.createdAt),
    })),
    revenues: revenues.map((item) => ({
      id: item.id,
      title: item.title,
      businessLine: item.businessLine,
      sourceTask: item.relatedTask?.title ?? item.source,
      amount: Number(item.amountFiat),
      tokenMapped: item.mappedToken,
      roi: item.mappedToken > 0 ? Number((Number(item.amountFiat) / Math.max(item.mappedToken / 1000, 1)).toFixed(2)) : 0,
    })),
    auditEvents: auditEvents.map((event) => ({
      id: event.id,
      taskId: event.taskId ?? '',
      agentId: event.agentId,
      level: event.riskLevel,
      issueType: event.issueType,
      title: humanizeIssueType(event.issueType),
      detail: event.detail,
      status: event.status,
      createdAt: formatDateTime(event.createdAt),
    })),
    storeItems: storeItems.map((item) => ({
      id: item.id,
      name: item.name,
      itemType: item.itemType,
      priceToken: item.priceToken,
      description: item.description,
      stockMode: item.stockMode,
      stockCount: item.stockCount,
      enabled: item.enabled,
    })),
    storeOrders: storeOrders.map((order) => ({
      id: order.id,
      buyerName: order.buyer.name,
      buyerAgentId: order.buyer.code,
      itemName: order.item.name,
      itemId: order.itemId,
      quantity: order.quantity,
      totalPrice: order.totalPrice,
      status: order.status,
      createdAt: formatDateTime(order.createdAt),
    })),
    treasury: {
      totalBalance: treasuryRecord?.totalBalance ?? 0,
      reservedBalance: treasuryRecord?.reservedBalance ?? 0,
      availableBalance: treasuryRecord?.availableBalance ?? 0,
    },
    performanceSummary: performance
      ? {
          reviewDate: performance.reviewDate,
          totalAgents: performance.records.length,
          avgScore: performance.avgScore,
          gradeDistribution: performance.gradeDistribution,
          topPerformer: performance.topPerformer,
          needsAttention: performance.needsAttention,
        }
      : undefined,
  }

  const content = `import type { AppSnapshot } from '../types'\n\nexport const appSnapshot: AppSnapshot = ${JSON.stringify(snapshot, null, 2)}\n`
  const snapshotJson = `${JSON.stringify(snapshot, null, 2)}\n`

  await Promise.all([
    fs.mkdir(path.dirname(outputPath), { recursive: true }),
    fs.mkdir(path.dirname(publicOutputPath), { recursive: true }),
  ])

  await Promise.all([
    fs.writeFile(outputPath, content, 'utf8'),
    fs.writeFile(publicOutputPath, snapshotJson, 'utf8'),
  ])

  return outputPath
}
