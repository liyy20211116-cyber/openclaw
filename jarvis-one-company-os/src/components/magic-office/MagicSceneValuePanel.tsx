type MagicSceneValuePanelProps = {
  safeNote: string
  theme: string
}

export function MagicSceneValuePanel({ safeNote, theme }: MagicSceneValuePanelProps) {
  return (
    <article className="panel magic-info-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">场景卖点</p>
          <h3>可换皮肤的动态办公室</h3>
        </div>
      </div>
      <div className="stack-list">
        <div className="stack-item">
          <strong>当前皮肤</strong>
          <p>{theme || 'original_magic_company'}：适合 AI Agent、一人公司和个人 IP 的魔法公司场景。</p>
        </div>
        <div className="stack-item">
          <strong>状态驱动</strong>
          <p>Agent 会根据运行状态、目标房间和审批需求移动到对应区域，仍服务任务、审批和经营主线。</p>
        </div>
        <div className="stack-item">
          <strong>边界</strong>
          <p>{safeNote || '原创魔法公司视觉，不使用受版权保护的人物形象、学院徽章或官方场景。'}</p>
        </div>
      </div>
    </article>
  )
}
