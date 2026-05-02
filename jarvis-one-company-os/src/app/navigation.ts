export interface NavItem {
  label: string
  path: string
  icon: string
  badge?: string
}

export const navItems: NavItem[] = [
  { label: 'CEO 驾驶舱', path: '/', icon: '\u{1F3AF}' },
  { label: '运行中心', path: '/runtime', icon: '\u{1F7E2}' },
  { label: '每日运营', path: '/daily-run', icon: '\u{1F305}' },
  { label: '办公室', path: '/office', icon: '\u{1F3E2}' },
  { label: '魔法办公室', path: '/magic-office', icon: '\u{1FA84}' },
  { label: '项目机会', path: '/opportunities', icon: '\u{1F50E}' },
  { label: '机会导入', path: '/opportunity-intake', icon: '\u{1F4E5}' },
  { label: '产品货架', path: '/offers', icon: '\u{1F6CD}' },
  { label: '销售管道', path: '/sales', icon: '\u{1F4C8}' },
  { label: '交付工作流', path: '/workflows', icon: '\u{1F9ED}' },
  { label: 'CEO 对话页', path: '/ceo-chat', icon: '\u{1F4AC}' },
  { label: '盈利边界', path: '/profitability', icon: '\u{1F4CA}' },
  { label: '盈利闭环', path: '/playbook', icon: '\u{1F680}' },
  { label: '角色中心', path: '/agents', icon: '\u{1F464}' },
  { label: '任务看板', path: '/tasks', icon: '\u{1F4CB}' },
  { label: '审批中心', path: '/approvals', icon: '\u{2705}' },
  { label: '动作边界', path: '/action-boundary', icon: '\u{1F6A7}' },
  { label: '初始化向导', path: '/onboarding', icon: '\u{1F9ED}' },
  { label: '商业化设置', path: '/commercialization', icon: '\u{1F4E6}' },
  { label: 'Token 国库', path: '/treasury', icon: '\u{1F3E6}' },
  { label: 'Token 超市', path: '/store', icon: '\u{1F6D2}' },
  { label: '利润中心', path: '/revenues', icon: '\u{1F4B0}' },
  { label: '收入确认', path: '/revenue-confirmation', icon: '\u{1F9FE}' },
  { label: '审计中心', path: '/audit', icon: '\u{1F6E1}' },
  { label: '配置中心', path: '/settings', icon: '\u{2699}\u{FE0F}' },
]
