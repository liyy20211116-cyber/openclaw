type CreateTaskPayload = {
  title: string
  description: string
  taskType: 'ops' | 'tech' | 'growth' | 'finance' | 'audit' | 'product' | 'sales' | 'customer'
  creatorAgentId: string
  ownerAgentId: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  budgetToken: number
  dueAt?: string
  requiresApproval: boolean
  approverId?: string
  taskId?: string
  sourceApprovalId?: string
}

type ApprovalDecisionPayload = {
  approvalId: string
  status: 'approved' | 'rejected'
  decisionNote?: string
}

type PurchaseStoreItemPayload = {
  buyerAgentId: string
  itemId: string
  quantity: number
}

type PaySalaryPayload = {
  agentId?: string
}

type AddRevenuePayload = {
  title: string
  businessLine: string
  source: string
  amountFiat: number
  mappedToken: number
  relatedTaskId?: string
  note?: string
}

type UpdateAuditPayload = {
  eventId: string
  status: 'resolved' | 'ignored'
  freezeTask?: boolean
}

type UpdateTaskStatusPayload = {
  taskId: string
  action: 'start' | 'submit_review' | 'complete' | 'freeze'
  operatorId: string
  note?: string
}

type ExecuteTaskOpenClawPayload = {
  taskId: string
  operatorId?: string
  dryRun?: boolean
}

type RunAuditInspectionPayload = {
  scope?: 'all' | 'recent'
}

type WritebackResult = {
  ok: boolean
  taskId?: string
  approvalId?: string
  orderId?: string
  status?: string
  executionStatus?: string
  snapshot?: string
  mode?: string
  error?: string
}

const API_BASE_URL = import.meta.env.VITE_WRITEBACK_API_BASE_URL ?? '/api'

async function request<TPayload>(path: string, payload: TPayload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = (await response.json()) as WritebackResult
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? '写回请求失败')
  }

  return data
}

export const writebackService = {
  createTask(payload: CreateTaskPayload) {
    return request('/writeback/create-task', payload)
  },
  decideApproval(payload: ApprovalDecisionPayload) {
    return request('/writeback/decide-approval', payload)
  },
  purchaseStoreItem(payload: PurchaseStoreItemPayload) {
    return request('/writeback/purchase-store-item', payload)
  },
  paySalary(payload: PaySalaryPayload) {
    return request('/writeback/pay-salary', payload)
  },
  addRevenue(payload: AddRevenuePayload) {
    return request('/writeback/add-revenue', payload)
  },
  updateAudit(payload: UpdateAuditPayload) {
    return request('/writeback/update-audit', payload)
  },
  updateTaskStatus(payload: UpdateTaskStatusPayload) {
    return request('/writeback/update-task-status', payload)
  },
  executeTaskOpenClaw(payload: ExecuteTaskOpenClawPayload) {
    return request('/writeback/execute-task-openclaw', payload)
  },
  runAuditInspection(payload: RunAuditInspectionPayload) {
    return request('/writeback/audit-inspection', payload)
  },
}

export type { ApprovalDecisionPayload, CreateTaskPayload, PurchaseStoreItemPayload, PaySalaryPayload, AddRevenuePayload, UpdateAuditPayload, UpdateTaskStatusPayload, ExecuteTaskOpenClawPayload, RunAuditInspectionPayload, WritebackResult }
