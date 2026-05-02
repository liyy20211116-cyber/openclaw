export type RuntimeScheduledTask = {
  name: string
  state: string
  result: string
  result_code?: number
  last_run_time?: string
  next_run_time?: string
}

export type RuntimeBusinessMonitor = {
  platform: string
  post_title: string
  status: string
  views: number
  likes: number
  favorites: number
  comments: number
  shares: number
  private_messages: number
  qualified_leads: number
  published_at: string
  last_checked_at: string
  next_action: string
}

export type RuntimeCompanyMetrics = {
  total_views: number
  total_interactions: number
  public_comments: number
  private_messages: number
  qualified_leads: number
  pending_replies: number
  active_platforms: number
  connected_platforms: number
}

export type RuntimePlatformStatus = {
  id: string
  name: string
  enabled: boolean
  account_name: string
  connection_status: string
  data_source: string
  views: number
  likes: number
  favorites: number
  comments: number
  shares: number
  private_messages: number
  qualified_leads: number
  drafts: number
  published: number
  risk: string
  last_sync: string
  next_check: string
  next_action: string
}

export type RuntimeContentPost = {
  platform: string
  post_title: string
  post_url: string
  status: string
  views: number
  likes: number
  favorites: number
  comments: number
  shares: number
  private_messages: number
  qualified_leads: number
  published_at: string
  last_checked_at: string
  next_action: string
  owner: string
  review_status: string
  next_topic: string
  private_domain_action: string
}

export type RuntimeCampaign = {
  id: string
  name: string
  stage: string
  owner: string
  platforms: string[]
  assets_ready: number
  assets_published: number
  total_views: number
  qualified_leads: number
  next_action: string
}

export type RuntimeLeadFunnelStage = {
  id: string
  name: string
  count: number
}

export type RuntimeLeadFunnel = {
  stages: RuntimeLeadFunnelStage[]
  next_action: string
}

export type RuntimeAgentOps = {
  agent_id: string
  name: string
  role: string
  status: string
  current_task: string
  last_action: string
  blocker: string
  next_action: string
  needs_ceo_review: boolean
}

export type RuntimeRiskAlert = {
  level: 'normal' | 'info' | 'warning' | 'critical' | string
  title: string
  detail: string
  owner: string
}

export type RuntimeModelInfo = {
  id: string
  name: string
  alias: string
  provider: string
  status: string
}

export type RuntimeModelHealth = {
  status: 'ready' | 'degraded' | 'not_configured' | string
  default_provider: string
  default_model: string
  enabled_providers: string[]
  fallback_chains: Record<string, string[]>
  routing_tiers: Record<string, string>
  models: RuntimeModelInfo[]
}

export type RuntimeAgentRosterItem = {
  agent_id: string
  name: string
  role: string
  role_label: string
  responsibility: string
  model_tier: string
  task_types: string[]
  skill_status: string
  openclaw_status: string
  status: string
}

export type RuntimeCompanyWorkItem = {
  owner: string
  name: string
  role: string
  workstream: string
  status: string
  next_action: string
  evidence: string
  cadence: string
}

export type RuntimeHrLearningAsset = {
  id: string
  owner: string
  title: string
  platforms: string[]
  patterns_count: number
  knowledge_path: string
  content_kit_path: string
  agent_tasks_path: string
  next_action: string
}

export type RuntimeRevenueGoal = {
  active: boolean
  run_id: string
  mode: string
  target_cny: number
  days: number
  booked_real_revenue: number
  current_gap_cny: number
  selected_project: string
  selected_project_id: string
  selected_score: number
  internal_executed_count: number
  approval_gated_count: number
  department_action_count: number
  approval_queue_count: number
  artifacts: Record<string, string>
  next_action: string
}

export type RuntimeOfficeZone = {
  id: string
  name: string
  purpose: string
  status: string
  owner_agents: string[]
}

export type RuntimeWorkstation = {
  agent_id: string
  agent_name: string
  zone_id: string
  desk_name: string
  status: string
  current_task: string
  last_action: string
  next_action: string
  blocker: string
  needs_ceo_review: boolean
}

export type RuntimeDailyRhythm = {
  time: string
  name: string
  owner: string
  output: string
}

export type RuntimeOffice = {
  zones: RuntimeOfficeZone[]
  workstations: RuntimeWorkstation[]
  daily_rhythm: RuntimeDailyRhythm[]
}

export type RuntimeEnablementPoint = {
  id: string
  name: string
  status: string
  owner: string
  next_action: string
  evidence: string
}

export type RuntimeMagicRoom = {
  id: string
  name: string
  purpose: string
  x: number
  y: number
  width: number
  height: number
  accent: string
}

export type RuntimeMagicCharacter = {
  agent_id: string
  display_name: string
  avatar_style: string
  room_id: string
  target_room_id: string
  x: number
  y: number
  action_state: string
  speech: string
  current_task: string
  last_action: string
  needs_ceo_review: boolean
}

export type RuntimeMagicActivity = {
  time: string
  agent: string
  action: string
}

export type RuntimeMagicOffice = {
  theme: string
  commercial_safe_note: string
  rooms: RuntimeMagicRoom[]
  characters: RuntimeMagicCharacter[]
  activity_log: RuntimeMagicActivity[]
}

export type RuntimeGuardian = {
  state: string
  last_result: number | string
  mode: string
  runtime_seconds: number | null
}

export type RuntimeSafety = {
  allow_publish: boolean
  allow_comment_reply: boolean
  allow_private_message: boolean
  allow_revenue_write_without_payment: boolean
  allow_readonly_metric_catchup?: boolean
}

export type RuntimeArtifacts = {
  health_report?: string
  monitor_csv?: string
  reply_suggestions?: string
}

export type RuntimeStatusSnapshot = {
  generated_at: string
  company_status: string
  last_action: string
  next_actions: string[]
  company_metrics: RuntimeCompanyMetrics
  business_monitor: RuntimeBusinessMonitor
  content_posts: RuntimeContentPost[]
  platforms: RuntimePlatformStatus[]
  campaigns: RuntimeCampaign[]
  lead_funnel: RuntimeLeadFunnel
  agent_ops: RuntimeAgentOps[]
  model_health: RuntimeModelHealth
  agent_roster: RuntimeAgentRosterItem[]
  company_work_queue: RuntimeCompanyWorkItem[]
  hr_learning_assets: RuntimeHrLearningAsset[]
  revenue_goal: RuntimeRevenueGoal
  office: RuntimeOffice
  magic_office: RuntimeMagicOffice
  enablement_points: RuntimeEnablementPoint[]
  risk_alerts: RuntimeRiskAlert[]
  scheduled_tasks: RuntimeScheduledTask[]
  guardian: RuntimeGuardian
  safety: RuntimeSafety
  artifacts: RuntimeArtifacts
}

type RuntimeStatusResponse = {
  ok?: boolean
  snapshot?: RuntimeStatusSnapshot
  error?: string
}

export async function fetchRuntimeStatus(): Promise<RuntimeStatusSnapshot> {
  const response = await fetch('/api/company/runtime-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  const data = (await response.json()) as RuntimeStatusResponse

  if (!response.ok || data.ok === false || !data.snapshot) {
    throw new Error(data.error ?? '运行状态读取失败')
  }

  return data.snapshot
}
