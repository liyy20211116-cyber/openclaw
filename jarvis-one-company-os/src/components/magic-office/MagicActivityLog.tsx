import type { RuntimeMagicActivity } from '../../services/runtimeStatusService'

type MagicActivityLogProps = {
  items: RuntimeMagicActivity[]
}

export function MagicActivityLog({ items }: MagicActivityLogProps) {
  return (
    <article className="panel magic-info-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">活动日志</p>
          <h3>谁在办公室里动了</h3>
        </div>
      </div>
      <div className="stack-list">
        {items.length > 0 ? items.map((item) => (
          <div className="stack-item" key={`${item.time}-${item.agent}-${item.action}`}>
            <strong>{item.time} · {item.agent}</strong>
            <p>{item.action}</p>
          </div>
        )) : (
          <div className="stack-item">
            <strong>暂无活动</strong>
            <p>等待下一次运行状态同步。</p>
          </div>
        )}
      </div>
    </article>
  )
}
