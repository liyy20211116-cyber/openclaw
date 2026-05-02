/**
 * Lightweight DAG workflow engine for multi-agent parallel orchestration.
 * Supports: parallel execution, dependency chains, conditional branching,
 * error retry, and persistent state (via backend API).
 */

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused'

export interface WorkflowNode {
  id: string
  agentId: string
  skillId: string
  label: string
  dependsOn: string[]
  condition?: (ctx: WorkflowContext) => boolean
  retryMax?: number
  timeoutMs?: number
  inputMapping?: Record<string, string>
  outputKey?: string
  requireApproval?: boolean
  branchCondition?: string
  branchTarget?: Record<string, string>
}

export interface WorkflowNodeState {
  nodeId: string
  status: NodeStatus
  output?: unknown
  error?: string
  attempts: number
  startedAt?: string
  completedAt?: string
}

export interface WorkflowContext {
  [nodeId: string]: unknown
}

export interface WorkflowDefinition {
  id: string
  name: string
  nodes: WorkflowNode[]
}

export interface WorkflowRun {
  id: string
  workflowId: string
  status: WorkflowStatus
  context: WorkflowContext
  nodeStates: Map<string, WorkflowNodeState>
  startedAt?: string
  completedAt?: string
  error?: string
}

export type WorkflowEventType = 'node_start' | 'node_complete' | 'node_fail' | 'node_skip' | 'workflow_complete' | 'workflow_fail'

export interface WorkflowEvent {
  type: WorkflowEventType
  nodeId?: string
  workflowRunId: string
  detail?: unknown
  timestamp: string
}

type EventListener = (event: WorkflowEvent) => void

function generateId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function nowISO(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export interface StandardSkillOutput {
  status: 'success' | 'partial' | 'failed'
  summary: string
  data: Record<string, unknown>
  artifacts?: Array<{ name: string; content: string; type: string }>
  metrics?: { executionMs?: number; [k: string]: unknown }
  error?: string
  nextAction?: { skillId: string; agentId: string; params?: Record<string, unknown> }
}

function parseSkillOutput(raw: unknown): StandardSkillOutput {
  if (!raw || typeof raw !== 'object') {
    return { status: 'success', summary: String(raw ?? ''), data: { raw } }
  }

  const obj = raw as Record<string, unknown>

  if ('status' in obj && 'summary' in obj) {
    return obj as unknown as StandardSkillOutput
  }

  return {
    status: obj.ok === false ? 'failed' : 'success',
    summary: typeof obj.summary === 'string' ? obj.summary : JSON.stringify(raw).slice(0, 200),
    data: obj as Record<string, unknown>,
  }
}

async function executeSkill(agentId: string, skillId: string, timeoutMs = 120_000): Promise<StandardSkillOutput> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch('/api/skills/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId, agentId }),
      signal: controller.signal,
    })

    clearTimeout(timer)
    if (!res.ok) throw new Error(`Skill API error: ${res.status}`)
    const data = await res.json()
    return parseSkillOutput(data)
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

export class WorkflowEngine {
  private listeners: EventListener[] = []

  on(listener: EventListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private emit(event: WorkflowEvent): void {
    for (const listener of this.listeners) {
      try { listener(event) } catch (e) { console.warn('[WorkflowEngine] event listener error:', e) }
    }
  }

  async execute(definition: WorkflowDefinition, input?: Record<string, unknown>): Promise<WorkflowRun> {
    const run: WorkflowRun = {
      id: generateId(),
      workflowId: definition.id,
      status: 'running',
      context: { ...input },
      nodeStates: new Map(),
      startedAt: nowISO(),
    }

    for (const node of definition.nodes) {
      run.nodeStates.set(node.id, {
        nodeId: node.id,
        status: 'pending',
        attempts: 0,
      })
    }

    try {
      await this.runDAG(definition.nodes, run)
      const anyFailed = [...run.nodeStates.values()].some(s => s.status === 'failed')
      run.status = anyFailed ? 'failed' : 'completed'
      run.completedAt = nowISO()

      this.emit({
        type: anyFailed ? 'workflow_fail' : 'workflow_complete',
        workflowRunId: run.id,
        timestamp: nowISO(),
      })
    } catch (err) {
      run.status = 'failed'
      run.error = err instanceof Error ? err.message : String(err)
      run.completedAt = nowISO()

      this.emit({
        type: 'workflow_fail',
        workflowRunId: run.id,
        detail: run.error,
        timestamp: nowISO(),
      })
    }

    return run
  }

  private async runDAG(nodes: WorkflowNode[], run: WorkflowRun): Promise<void> {
    const completed = new Set<string>()
    const failed = new Set<string>()

    while (completed.size + failed.size < nodes.length) {
      const ready = nodes.filter(n => {
        if (completed.has(n.id) || failed.has(n.id)) return false
        const state = run.nodeStates.get(n.id)
        if (state?.status === 'running') return false
        return n.dependsOn.every(dep => completed.has(dep))
      })

      if (ready.length === 0) {
        const pending = nodes.filter(n => !completed.has(n.id) && !failed.has(n.id))
        if (pending.length > 0) {
          for (const p of pending) {
            const blockedBy = p.dependsOn.filter(d => failed.has(d))
            if (blockedBy.length > 0) {
              const state = run.nodeStates.get(p.id)!
              state.status = 'skipped'
              state.error = `Blocked by failed: ${blockedBy.join(', ')}`
              failed.add(p.id)

              this.emit({
                type: 'node_skip',
                nodeId: p.id,
                workflowRunId: run.id,
                detail: state.error,
                timestamp: nowISO(),
              })
            }
          }
          if (completed.size + failed.size >= nodes.length) break
        }
        break
      }

      const results = await Promise.allSettled(
        ready.map(node => this.runNode(node, run))
      )

      for (let i = 0; i < ready.length; i++) {
        const node = ready[i]
        const result = results[i]
        if (result.status === 'fulfilled') {
          completed.add(node.id)
        } else {
          failed.add(node.id)
        }
      }
    }
  }

  private async runNode(node: WorkflowNode, run: WorkflowRun): Promise<void> {
    const state = run.nodeStates.get(node.id)!

    if (node.condition && !node.condition(run.context)) {
      state.status = 'skipped'
      this.emit({
        type: 'node_skip',
        nodeId: node.id,
        workflowRunId: run.id,
        timestamp: nowISO(),
      })
      return
    }

    const maxRetry = node.retryMax ?? 1
    for (let attempt = 0; attempt < maxRetry; attempt++) {
      state.attempts = attempt + 1
      state.status = 'running'
      state.startedAt = nowISO()

      this.emit({
        type: 'node_start',
        nodeId: node.id,
        workflowRunId: run.id,
        detail: { attempt: attempt + 1, maxRetry },
        timestamp: nowISO(),
      })

      try {
        const output = await executeSkill(node.agentId, node.skillId, node.timeoutMs)

        if (output.status === 'failed') {
          throw new Error(output.error ?? output.summary ?? 'Skill reported failure')
        }

        state.status = 'completed'
        state.output = output
        state.completedAt = nowISO()
        run.context[node.id] = output

        this.emit({
          type: 'node_complete',
          nodeId: node.id,
          workflowRunId: run.id,
          detail: { summary: output.summary, metrics: output.metrics, nextAction: output.nextAction },
          timestamp: nowISO(),
        })
        return
      } catch (err) {
        state.error = err instanceof Error ? err.message : String(err)
        if (attempt < maxRetry - 1) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
        }
      }
    }

    state.status = 'failed'
    state.completedAt = nowISO()

    this.emit({
      type: 'node_fail',
      nodeId: node.id,
      workflowRunId: run.id,
      detail: state.error,
      timestamp: nowISO(),
    })

    throw new Error(`Node ${node.id} failed after ${maxRetry} attempts: ${state.error}`)
  }
}

export const workflowEngine = new WorkflowEngine()

// ─── 预置工作流模板 ───

export const BUILTIN_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'daily_ops',
    name: '日常运营巡检',
    nodes: [
      { id: 'tech_check', agentId: 'hermione-tech', skillId: 'hermione_check_services', label: '技术服务检查', dependsOn: [], retryMax: 2 },
      { id: 'security_scan', agentId: 'snape-audit', skillId: 'snape_security_scan', label: '安全扫描', dependsOn: [], retryMax: 2 },
      { id: 'finance_report', agentId: 'percy-finance', skillId: 'percy_token_report', label: '财务报告', dependsOn: [], retryMax: 2 },
      { id: 'content_stats', agentId: 'luna-growth', skillId: 'luna_content_stats', label: '内容统计', dependsOn: [], retryMax: 2 },
      { id: 'hr_report', agentId: 'neville-hr', skillId: 'neville_hr_report', label: '人事报告', dependsOn: [], retryMax: 2 },
      { id: 'company_status', agentId: 'jarvis-coo', skillId: 'jarvis_company_status', label: '全局汇总', dependsOn: ['tech_check', 'security_scan', 'finance_report', 'content_stats', 'hr_report'] },
    ],
  },
  {
    id: 'full_audit',
    name: '全面审计',
    nodes: [
      { id: 'code_review', agentId: 'hermione-tech', skillId: 'hermione_code_review', label: '代码审查', dependsOn: [], retryMax: 2 },
      { id: 'security_scan', agentId: 'snape-audit', skillId: 'snape_security_scan', label: '安全扫描', dependsOn: [], retryMax: 2 },
      { id: 'revenue_audit', agentId: 'snape-audit', skillId: 'snape_revenue_audit', label: '营收审计', dependsOn: [], retryMax: 2 },
      { id: 'budget_check', agentId: 'percy-finance', skillId: 'percy_budget_check', label: '预算检查', dependsOn: [], retryMax: 2 },
      { id: 'audit_summary', agentId: 'snape-audit', skillId: 'snape_audit_log', label: '审计汇总', dependsOn: ['code_review', 'security_scan', 'revenue_audit', 'budget_check'] },
    ],
  },
  {
    id: 'product_launch_check',
    name: '产品发布前检查',
    nodes: [
      { id: 'acceptance', agentId: 'mcgonagall-product', skillId: 'mcgonagall_acceptance_check', label: '产品验收', dependsOn: [] },
      { id: 'tech_test', agentId: 'hermione-tech', skillId: 'hermione_run_test', label: '测试运行', dependsOn: [] },
      { id: 'ux_check', agentId: 'dobby-customer', skillId: 'dobby_ux_walkthrough', label: 'UX 走查', dependsOn: [] },
      { id: 'security', agentId: 'snape-audit', skillId: 'snape_security_scan', label: '安全检查', dependsOn: ['tech_test'] },
      { id: 'sales_ready', agentId: 'fred-sales', skillId: 'fred_sales_stats', label: '销售准备', dependsOn: ['acceptance'] },
    ],
  },
  {
    id: 'content_pipeline',
    name: '内容生产管道',
    nodes: [
      { id: 'research', agentId: 'luna-growth', skillId: 'luna_xhs_research', label: '话题调研', dependsOn: [], retryMax: 2, outputKey: 'researchData' },
      { id: 'draft', agentId: 'luna-growth', skillId: 'luna_draft_generator', label: '草稿生成', dependsOn: ['research'], inputMapping: { topics: 'research.data.keywords' } },
      { id: 'review', agentId: 'mcgonagall-product', skillId: 'mcgonagall_content_analysis', label: '内容审核', dependsOn: ['draft'], requireApproval: true },
      { id: 'publish', agentId: 'luna-growth', skillId: 'luna_auto_publisher', label: '自动发布', dependsOn: ['review'] },
      { id: 'stats', agentId: 'luna-growth', skillId: 'luna_content_stats', label: '效果统计', dependsOn: ['publish'] },
    ],
  },
  {
    id: 'sales_qualification',
    name: '销售线索资格认定',
    nodes: [
      { id: 'score', agentId: 'fred-sales', skillId: 'fred_lead_scorer', label: '线索评分', dependsOn: [], retryMax: 2 },
      { id: 'analyze', agentId: 'fred-sales', skillId: 'fred_pipeline_analytics', label: '管道分析', dependsOn: ['score'] },
      { id: 'outreach', agentId: 'fred-sales', skillId: 'fred_outreach_generator', label: '触达方案', dependsOn: ['score'] },
      { id: 'roi_calc', agentId: 'percy-finance', skillId: 'percy_roi_calculator', label: 'ROI 测算', dependsOn: ['analyze'] },
    ],
  },
  {
    id: 'customer_health_check',
    name: '客户健康巡检',
    nodes: [
      { id: 'health', agentId: 'dobby-customer', skillId: 'dobby_customer_health', label: '客户健康评估', dependsOn: [], retryMax: 2 },
      { id: 'feedback', agentId: 'dobby-customer', skillId: 'dobby_feedback_collector', label: '反馈收集', dependsOn: [] },
      { id: 'satisfaction', agentId: 'dobby-customer', skillId: 'dobby_satisfaction_survey', label: '满意度调查', dependsOn: ['health', 'feedback'] },
      { id: 'smart_service', agentId: 'dobby-customer', skillId: 'dobby_smart_customer_service', label: '智能客服建议', dependsOn: ['satisfaction'] },
    ],
  },
  {
    id: 'memory_maintenance',
    name: '记忆维护',
    nodes: [
      { id: 'decay', agentId: 'jarvis-coo', skillId: '__memory_decay__', label: '记忆衰减', dependsOn: [] },
      { id: 'refine_jarvis', agentId: 'jarvis-coo', skillId: 'jarvis_refine_memory', label: 'Jarvis 记忆精炼', dependsOn: ['decay'] },
      { id: 'refine_hermione', agentId: 'hermione-tech', skillId: 'hermione_refine_memory', label: 'Hermione 记忆精炼', dependsOn: ['decay'] },
    ],
  },
]
