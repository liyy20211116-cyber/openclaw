export interface Skill {
  id: string
  name: string
  description: string
  script: string
  available: boolean
}

export interface SkillResult {
  ok: boolean
  result: {
    exitCode?: number
    output?: string
    parsed?: unknown
    message: string
    summary?: string
    pending_reviews?: number
    processed_log?: number
    token_status?: string
    card_handler_active?: boolean
    pid?: number
    valid?: boolean
    remaining_minutes?: number
  }
}

export async function listSkills(agentId?: string): Promise<Skill[]> {
  try {
    const res = await fetch('/api/skills/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentId ? { agentId } : {}),
    })
    const data = await res.json()
    return data.skills ?? []
  } catch (e) {
    console.warn('[skillMatcher] listSkills failed:', e)
    return []
  }
}

export async function runSkill(skillId: string, agentId?: string, args?: string): Promise<SkillResult> {
  try {
    const body: Record<string, string> = { skillId }
    if (agentId) body.agentId = agentId
    if (args) body.args = args
    const res = await fetch('/api/skills/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.result) data.result = { message: data.error || (data.ok ? '执行成功' : '执行失败') }
    return data
  } catch (e) {
    return { ok: false, result: { message: `调用失败: ${e}` } }
  }
}

const SKILL_PATTERNS: [RegExp, string, string][] = [
  [/扫描|待审批|检查.*需求|查看.*卡片|飞书.*表格|发送.*审核/i, 'ones_scan_pending', 'req-review-agent'],
  [/ones.*状态|项目状态|pending|processed|多少.*条|处理.*了/i, 'ones_check_status', 'req-review-agent'],
  [/监听|card.*handler|回调|webhook|卡片.*监听/i, 'ones_start_listener', 'req-review-agent'],
  [/缺口.*盘点|缺口.*分析|技术.*缺口|接口.*缺口|收口|闭环.*方案|联调/i, 'hermione_tech_analysis', 'hermione-tech'],
  [/规则.*引擎|规则.*方案|异常.*兜底|异常.*处理.*方案|脏数据/i, 'hermione_tech_analysis', 'hermione-tech'],
  [/技术.*方案|技术.*报告|架构.*分析|技术.*评审/i, 'hermione_tech_analysis', 'hermione-tech'],
  [/代码.*审查|code.*review|查代码|代码质量/i, 'hermione_code_review', 'hermione-tech'],
  [/运行.*测试|跑.*测试|test|验证/i, 'hermione_run_test', 'hermione-tech'],
  [/服务.*状态|检查.*服务|连通性|诊断/i, 'hermione_check_services', 'hermione-tech'],
  [/部署|deploy|修复.*配置/i, 'hermione_deploy_fix', 'hermione-tech'],
  [/验收|acceptance|完成.*度|做完.*没/i, 'mcgonagall_acceptance_check', 'mcgonagall-product'],
  [/需求.*分析|分析.*需求|requirement/i, 'mcgonagall_requirement_analysis', 'mcgonagall-product'],
  [/PRD|产品.*文档|需求.*文档/i, 'mcgonagall_write_prd', 'mcgonagall-product'],
  [/内容.*分析|爆款.*分析|数据.*分析.*内容/i, 'mcgonagall_content_analysis', 'mcgonagall-product'],
  [/选题|topic.*plan|选题.*规划|选题.*建议/i, 'mcgonagall_topic_planner', 'mcgonagall-product'],
  [/流水线|pipeline|生成.*视频|出片|日报|新闻/i, 'luna_content_pipeline', 'luna-growth'],
  [/内容.*统计|产出.*统计|output.*stats/i, 'luna_content_stats', 'luna-growth'],
  [/写.*文章|撰写.*内容|公众号/i, 'luna_write_article', 'luna-growth'],
  [/小红书.*研究|小红书.*话题|xhs.*research|红书.*搜索/i, 'luna_xhs_research', 'luna-growth'],
  [/小红书.*竞品|小红书.*分析|xhs.*competitor|红书.*对比/i, 'luna_xhs_competitor', 'luna-growth'],
  [/内容.*日历|排期.*计划|发布.*计划|content.*calendar/i, 'luna_content_calendar_gen', 'luna-growth'],
  [/抖音.*热点|抖音.*热搜|douyin.*trending|抖音.*趋势/i, 'luna_douyin_trending', 'luna-growth'],
  [/草稿|draft|生成.*内容|写.*笔记|写.*脚本.*抖音/i, 'luna_draft_generator', 'luna-growth'],
  [/报价|定价|pricing|proposal/i, 'fred_pricing_proposal', 'fred-sales'],
  [/客户.*画像|customer.*profile|获客/i, 'fred_customer_analysis', 'fred-sales'],
  [/销售.*数据|商务.*统计|漏斗/i, 'fred_sales_stats', 'fred-sales'],
  [/token.*报告|消耗.*统计|财务.*报告|成本/i, 'percy_token_report', 'percy-finance'],
  [/预算|budget|超标/i, 'percy_budget_check', 'percy-finance'],
  [/结算|ROI|投入.*产出/i, 'percy_project_settlement', 'percy-finance'],
  [/安全.*扫描|密钥.*泄露|security|漏洞/i, 'snape_security_scan', 'snape-audit'],
  [/审计.*日志|合规|audit/i, 'snape_audit_log', 'snape-audit'],
  [/质量.*检查|幻觉|quality/i, 'snape_quality_gate', 'snape-audit'],
  [/体验.*走查|UX|用户.*体验|走查/i, 'dobby_ux_walkthrough', 'dobby-customer'],
  [/客户.*反馈|feedback|满意度/i, 'dobby_feedback_summary', 'dobby-customer'],
  [/引导|onboard|FAQ/i, 'dobby_onboard_guide', 'dobby-customer'],
  [/人事|编制|花名册|团队.*配置|roster/i, 'neville_hr_report', 'neville-hr'],
  [/绩效|performance|考核/i, 'neville_performance_review', 'neville-hr'],
  [/入职|onboarding.*员工/i, 'neville_onboarding', 'neville-hr'],
  [/全局.*状态|公司.*状态|总览|dashboard/i, 'jarvis_company_status', 'jarvis-coo'],
  [/派发|dispatch|全.*执行|批量/i, 'jarvis_dispatch_tasks', 'jarvis-coo'],
  [/日报|周报|汇总.*报告/i, 'jarvis_daily_report', 'jarvis-coo'],
]

export function matchSkillFromReply(reply: string): string | null {
  for (const [pattern, skillId] of SKILL_PATTERNS) {
    if (pattern.test(reply)) return skillId
  }
  return null
}

export function matchSkillWithAgent(reply: string): { skillId: string; agentId: string } | null {
  for (const [pattern, skillId, agentId] of SKILL_PATTERNS) {
    if (pattern.test(reply)) return { skillId, agentId }
  }
  return null
}

export function matchAgentDefaultSkill(agentId: string): string | null {
  const defaults: Record<string, string> = {
    'jarvis-coo': 'jarvis_company_status',
    'hermione-tech': 'hermione_tech_analysis',
    'mcgonagall-product': 'mcgonagall_acceptance_check',
    'luna-growth': 'luna_content_stats',
    'fred-sales': 'fred_sales_stats',
    'percy-finance': 'percy_token_report',
    'snape-audit': 'snape_audit_log',
    'dobby-customer': 'dobby_ux_walkthrough',
    'neville-hr': 'neville_hr_report',
    'req-review-agent': 'ones_check_status',
  }
  return defaults[agentId] ?? null
}
