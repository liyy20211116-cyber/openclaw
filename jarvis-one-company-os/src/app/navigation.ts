export interface NavItem {
  label: string
  path: string
  icon: string
  badge?: string
}

export const navItems: NavItem[] = [
  { label: 'CEO 驾驶舱', path: '/', icon: '\u{1F3AF}' },
  { label: 'CEO 对话页', path: '/ceo-chat', icon: '\u{1F4AC}' },
  { label: '盈利闭环', path: '/playbook', icon: '\u{1F680}' },
  { label: '角色中心', path: '/agents', icon: '\u{1F464}' },
  { label: '任务看板', path: '/tasks', icon: '\u{1F4CB}' },
  { label: '审批中心', path: '/approvals', icon: '\u{2705}' },
  { label: 'Token 国库', path: '/treasury', icon: '\u{1F3E6}' },
  { label: 'Token 超市', path: '/store', icon: '\u{1F6D2}' },
  { label: '利润中心', path: '/revenues', icon: '\u{1F4B0}' },
  { label: '审计中心', path: '/audit', icon: '\u{1F6E1}' },
]
