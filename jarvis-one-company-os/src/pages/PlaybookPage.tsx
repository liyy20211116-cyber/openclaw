import { useState } from 'react'
// import { useNavigate } from 'react-router'
import { useSnapshot } from '../hooks/useSnapshot'
import { refreshSnapshot } from '../lib/snapshotStore'
import { businessLineService } from '../services/businessLineService'
import { taskService } from '../services/taskService'
import { revenueService } from '../services/revenueService'
import { writebackService } from '../services/writebackService'
import { decomposeGoal } from '../services/goalDecomposeService'
import type { BusinessLine, PlaybookStage, GoalDecomposition } from '../types'

const stageTemplate: Omit<PlaybookStage, 'id'>[] = [
  { name: 'CEO 目标下达', description: '明确业务方向与阶段性目标', status: 'pending' },
  { name: '贾维斯拆解', description: '智能拆解为可执行任务清单', status: 'pending' },
  { name: '审批流转', description: '需审批任务进入审批中心', status: 'pending' },
  { name: '多角色执行', description: 'OpenClaw 或手动推进任务', status: 'pending' },
  { name: '交付验收', description: '任务产出物提交复审', status: 'pending' },
  { name: '收入录入', description: '真实成交记录进入利润中心', status: 'pending' },
  { name: '利润分账', description: 'Token 分账回流国库与角色钱包', status: 'pending' },
]

const statusColors: Record<string, string> = {
  pending: '#94a3b8',
  active: '#38bdf8',
  completed: '#22c55e',
  skipped: '#64748b',
}

const typeLabels: Record<string, string> = { ops: '运营', tech: '技术', product: '产品', growth: '增长', sales: '销售', finance: '财务', audit: '审计', customer: '客户' }

export function PlaybookPage() {
  useSnapshot()
  // const navigate = useNavigate()

  const businessLines = businessLineService.getAll()
  const profitSummary = businessLineService.getProfitSummary()
  const tasks = taskService.getAll()
  const revenues = revenueService.getAll()

  const [selectedBL, setSelectedBL] = useState<BusinessLine | null>(businessLines.find((bl) => bl.status === 'active') ?? null)
  const [runningDemo, setRunningDemo] = useState(false)
  const [demoStages, setDemoStages] = useState<PlaybookStage[]>([])
  const [, setDemoDecomposition] = useState<GoalDecomposition | null>(null)
  const [demoLog, setDemoLog] = useState<string[]>([])
  const [feedback, setFeedback] = useState('')

  function getStagesForBL(bl: BusinessLine): PlaybookStage[] {
    const blRevenues = revenues.filter((r) => r.businessLine === bl.name)
    const blTasks = tasks.filter((t) =>
      blRevenues.some((r) => r.sourceTask === t.title) || t.title.includes(bl.name.slice(0, 6)),
    )

    const hasGoal = blTasks.length > 0
    const hasDecomposed = blTasks.length >= 2
    const hasPendingApproval = blTasks.some((t) => t.status === 'pending_approval')
    const hasApproved = blTasks.some((t) => ['approved', 'in_progress', 'review', 'completed'].includes(t.status))
    const hasInProgress = blTasks.some((t) => ['in_progress', 'review', 'completed'].includes(t.status))
    const hasCompleted = blTasks.some((t) => t.status === 'completed' || t.status === 'review')
    const hasRevenue = blRevenues.length > 0
    const hasProfit = blRevenues.reduce((sum, r) => sum + r.amount, 0) > 0

    return stageTemplate.map((tpl, idx) => {
      let status: PlaybookStage['status'] = 'pending'
      const conditions = [hasGoal, hasDecomposed, hasPendingApproval || hasApproved, hasInProgress, hasCompleted, hasRevenue, hasProfit]
      if (conditions[idx]) status = 'completed'
      else if (idx > 0 && conditions[idx - 1]) status = 'active'

      return { ...tpl, id: `stage_${idx}`, status }
    })
  }

  async function runDemoPlaybook() {
    if (!selectedBL) return
    setRunningDemo(true)
    setFeedback('')
    setDemoLog([])

    const stages = stageTemplate.map((tpl, idx) => ({
      ...tpl,
      id: `demo_${idx}`,
      status: 'pending' as PlaybookStage['status'],
    }))
    setDemoStages(stages)

    const log: string[] = []
    const updateStage = (idx: number, status: PlaybookStage['status']) => {
      setDemoStages((prev) => prev.map((s, i) => (i === idx ? { ...s, status } : s)))
    }

    try {
      updateStage(0, 'active')
      log.push(`[阶段1] CEO 下达目标：「基于${selectedBL.name}，完成首单交付并形成可复制流程」`)
      setDemoLog([...log])
      await delay(800)
      updateStage(0, 'completed')

      updateStage(1, 'active')
      const goal = `推进${selectedBL.name}业务，完成产品定义、技术交付和获客内容`
      const decomposition = decomposeGoal(goal)
      setDemoDecomposition(decomposition)
      log.push(`[阶段2] 贾维斯拆解为 ${decomposition.tasks.length} 个任务`)
      decomposition.tasks.forEach((t) => {
        log.push(`  · ${t.title}（${t.ownerName} / ${typeLabels[t.taskType]} / ${t.budgetToken} Token）`)
      })
      setDemoLog([...log])
      await delay(800)
      updateStage(1, 'completed')

      updateStage(2, 'active')
      const needsApproval = decomposition.tasks.filter((t) => t.requiresApproval)
      log.push(`[阶段3] ${needsApproval.length} 个任务需要审批`)
      for (const t of needsApproval) {
        log.push(`  · ${t.title} → CEO 审批通过 ✓`)
      }
      setDemoLog([...log])
      await delay(600)
      updateStage(2, 'completed')

      updateStage(3, 'active')
      log.push(`[阶段4] 分配给 ${new Set(decomposition.tasks.map((t) => t.ownerName)).size} 个角色并行执行`)
      for (const t of decomposition.tasks) {
        log.push(`  · ${t.ownerName} 执行「${t.title}」→ 已完成 ✓`)
      }
      setDemoLog([...log])
      await delay(1000)
      updateStage(3, 'completed')

      updateStage(4, 'active')
      log.push('[阶段5] 审计官复审交付质量 → 通过')
      log.push('  · 预算未超支 ✓')
      log.push('  · 任务描述完整 ✓')
      log.push('  · 交付物齐全 ✓')
      setDemoLog([...log])
      await delay(600)
      updateStage(4, 'completed')

      updateStage(5, 'active')
      const price = selectedBL.pricingTiers[0]?.price ?? 2999
      const totalCost = selectedBL.costStructure.reduce((sum, c) => sum + c.fiatCost, 0)
      log.push(`[阶段6] 录入收入 ¥${price.toLocaleString()}（${selectedBL.pricingTiers[0]?.name ?? '基础版'}）`)
      setDemoLog([...log])
      await delay(500)
      updateStage(5, 'completed')

      updateStage(6, 'active')
      const profit = price - totalCost
      const margin = ((profit / price) * 100).toFixed(1)
      log.push(`[阶段7] 利润分账完成`)
      log.push(`  · 收入：¥${price.toLocaleString()}`)
      log.push(`  · 成本：¥${totalCost.toLocaleString()}（模型 + 搜索 + 部署）`)
      log.push(`  · 净利润：¥${profit.toLocaleString()}（利润率 ${margin}%）`)
      log.push(`  · Token 回流国库：${Math.round(price * 1.2)} Token`)
      setDemoLog([...log])
      await delay(500)
      updateStage(6, 'completed')

      setFeedback(`演示完成！${selectedBL.name}首单利润率 ${margin}%，端到端闭环验证通过。`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '演示执行失败')
    } finally {
      setRunningDemo(false)
    }
  }

  async function runRealPlaybook() {
    if (!selectedBL) return
    setRunningDemo(true)
    setFeedback('')

    try {
      const goal = `推进${selectedBL.name}业务，完成产品定义和获客内容`
      const decomposition = decomposeGoal(goal)

      let created = 0
      for (const task of decomposition.tasks) {
        await writebackService.createTask({
          title: `[${selectedBL.name}] ${task.title}`,
          description: task.description,
          taskType: task.taskType,
          creatorAgentId: 'jarvis',
          ownerAgentId: task.ownerAgentId,
          priority: task.priority,
          budgetToken: task.budgetToken,
          dueAt: task.dueAt,
          requiresApproval: task.requiresApproval,
          approverId: task.requiresApproval ? 'ceo' : undefined,
        })
        created++
      }

      await refreshSnapshot()
      setFeedback(`已为「${selectedBL.name}」创建 ${created} 个任务。前往任务看板查看并推进执行。`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '创建失败')
    } finally {
      setRunningDemo(false)
    }
  }

  const currentStages = selectedBL ? getStagesForBL(selectedBL) : []
  const completedStageCount = currentStages.filter((s) => s.status === 'completed').length

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">盈利闭环</p>
          <h2>Playbook 验证中心</h2>
          <p className="muted">选定业务线，走通「目标 → 拆解 → 执行 → 收入 → 利润」全链路。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">
            净利润 ¥{profitSummary.netProfit.toLocaleString()}
          </div>
          <div className="metric-inline">
            利润率 {profitSummary.profitMargin.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="metrics-grid">
        {businessLines.map((bl) => (
          <button
            key={bl.id}
            type="button"
            className={`template-card ${selectedBL?.id === bl.id ? 'active' : ''}`}
            onClick={() => { setSelectedBL(bl); setDemoStages([]); setDemoLog([]); setDemoDecomposition(null); setFeedback('') }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 13 }}>{bl.name}</strong>
              <span className={`status-pill ${bl.status === 'active' ? 'idle' : 'review'}`}>
                {bl.status === 'active' ? '运营中' : bl.status === 'planning' ? '规划中' : '已暂停'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12 }}>{bl.description}</p>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {bl.pricingTiers.map((tier) => (
                <span key={tier.name} className="metric-inline" style={{ fontSize: 10 }}>
                  {tier.name} ¥{tier.price.toLocaleString()}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {selectedBL && (
        <>
          <div className="form-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p className="eyebrow">{selectedBL.name} — 闭环 {completedStageCount}/{currentStages.length}</p>
              </div>
              <div className="hero-actions">
                <button type="button" onClick={runDemoPlaybook} disabled={runningDemo}>
                  {runningDemo ? '演示中...' : '运行演示'}
                </button>
                <button type="button" className="secondary" onClick={runRealPlaybook} disabled={runningDemo}>
                  创建任务
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 8, overflowX: 'auto', padding: '4px 0' }}>
              {(demoStages.length > 0 ? demoStages : currentStages).map((stage, idx) => (
                <div key={stage.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 10px',
                    borderRadius: 10,
                    border: `1px solid ${stage.status === 'active' ? 'rgba(56, 189, 248, 0.5)' : 'rgba(148, 163, 184, 0.14)'}`,
                    background: stage.status === 'active' ? 'rgba(56, 189, 248, 0.1)' : stage.status === 'completed' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(30, 41, 59, 0.56)',
                    minWidth: 72,
                  }}>
                    <div style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: statusColors[stage.status],
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 11,
                      color: '#fff',
                      fontWeight: 700,
                    }}>
                      {stage.status === 'completed' ? '✓' : stage.status === 'active' ? '▸' : idx + 1}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, textAlign: 'center', color: stage.status === 'pending' ? '#94a3b8' : '#f8fafc' }}>
                      {stage.name}
                    </span>
                  </div>
                  {idx < (demoStages.length > 0 ? demoStages : currentStages).length - 1 && (
                    <div style={{ width: 20, height: 2, background: stage.status === 'completed' ? '#22c55e' : 'rgba(148, 163, 184, 0.2)', flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {feedback && (
            <div className={feedback.includes('失败') ? 'feedback-banner error' : 'feedback-banner success'}>
              {feedback}
            </div>
          )}

          {demoLog.length > 0 && (
            <div className="form-panel">
              <p className="eyebrow" style={{ marginBottom: 6 }}>执行日志</p>
              <div style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, color: '#cbd5e1', maxHeight: 180, overflowY: 'auto' }}>
                {demoLog.map((line, i) => (
                  <div key={i} style={{ color: line.startsWith('[') ? '#7dd3fc' : line.includes('✓') ? '#86efac' : '#cbd5e1' }}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="page-split-grid">
            <div className="form-panel">
              <p className="eyebrow" style={{ marginBottom: 6 }}>定价方案</p>
              <div className="stack-list compact-gap">
                {selectedBL.pricingTiers.map((tier) => (
                  <div key={tier.name} className="stack-item" style={{ padding: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <strong>{tier.name}</strong>
                      <span style={{ color: '#22c55e', fontWeight: 700 }}>¥{tier.price.toLocaleString()}</span>
                    </div>
                    <p className="history-note" style={{ margin: '2px 0 0' }}>{tier.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-panel">
              <p className="eyebrow" style={{ marginBottom: 6 }}>成本 + 利润</p>
              <div className="stack-list compact-gap">
                {selectedBL.costStructure.map((cost) => (
                  <div key={cost.label} className="stack-item" style={{ padding: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{cost.label}</span>
                      <span style={{ color: '#fbbf24' }}>{cost.tokenCost}T / ¥{cost.fiatCost}</span>
                    </div>
                  </div>
                ))}
                <div className="stack-item" style={{ padding: 8, background: 'rgba(56, 189, 248, 0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <strong>总成本</strong>
                    <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                      {selectedBL.costStructure.reduce((s, c) => s + c.tokenCost, 0)}T / ¥{selectedBL.costStructure.reduce((s, c) => s + c.fiatCost, 0)}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                {selectedBL.pricingTiers.map((tier) => {
                  const cost = selectedBL.costStructure.reduce((s, c) => s + c.fiatCost, 0)
                  const profit = tier.price - cost
                  const margin = ((profit / tier.price) * 100).toFixed(1)
                  return (
                    <div key={tier.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(148,163,184,0.1)', fontSize: 12 }}>
                      <span>{tier.name}</span>
                      <span style={{ color: profit > 0 ? '#86efac' : '#fca5a5' }}>
                        净利 ¥{profit.toLocaleString()} ({margin}%)
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {revenues.filter((r) => r.businessLine === selectedBL.name).length > 0 && (
            <div className="form-panel">
              <p className="eyebrow" style={{ marginBottom: 6 }}>已录入收入</p>
              <div className="stack-list compact-gap">
                {revenues.filter((r) => r.businessLine === selectedBL.name).map((r) => (
                  <div key={r.id} className="stack-item" style={{ padding: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <strong>{r.title}</strong>
                      <span style={{ color: '#22c55e', fontWeight: 700 }}>¥{r.amount.toLocaleString()}</span>
                    </div>
                    <p className="history-note" style={{ margin: '2px 0 0' }}>
                      {r.sourceTask} · {r.tokenMapped.toLocaleString()}T · ROI {r.roi}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
