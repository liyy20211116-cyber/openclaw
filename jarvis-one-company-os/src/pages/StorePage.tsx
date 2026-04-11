import { useState } from 'react'
import { useSnapshot } from '../hooks/useSnapshot'
import { refreshSnapshot } from '../lib/snapshotStore'
import { agentService } from '../services/agentService'
import { storeService } from '../services/storeService'
import { writebackService } from '../services/writebackService'

const itemTypeLabels: Record<string, string> = {
  model_pack: '模型额度',
  search_pack: '搜索额度',
  image_pack: '视觉资源',
  api_pack: 'API 调用',
  priority_pass: '优先执行',
}

export function StorePage() {
  useSnapshot()
  const items = storeService.getEnabledItems()
  const orders = storeService.getAllOrders()
  const agents = agentService.getAll().filter((a) => a.id !== 'ceo')

  const [buyerAgentId, setBuyerAgentId] = useState(agents[0]?.id ?? '')
  const [purchasingItemId, setPurchasingItemId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  const selectedAgent = agents.find((a) => a.id === buyerAgentId.replace('agent_', ''))
    ?? agents.find((a) => `agent_${a.id}` === buyerAgentId)

  async function handlePurchase(itemId: string) {
    setPurchasingItemId(itemId)
    setFeedback((prev) => ({ ...prev, [itemId]: '' }))

    const agentDbId = buyerAgentId.startsWith('agent_') ? buyerAgentId : `agent_${buyerAgentId}`

    try {
      await writebackService.purchaseStoreItem({
        buyerAgentId: agentDbId,
        itemId,
        quantity,
      })
      await refreshSnapshot()
      setFeedback((prev) => ({ ...prev, [itemId]: '购买成功' }))
      setQuantity(1)
    } catch (error) {
      setFeedback((prev) => ({
        ...prev,
        [itemId]: error instanceof Error ? error.message : '购买失败',
      }))
    } finally {
      setPurchasingItemId('')
    }
  }

  return (
    <section className="panel page-panel">
      <div className="panel-header panel-header-top">
        <div>
          <p className="eyebrow">Token 超市</p>
          <h2>资源商店</h2>
          <p className="muted">角色使用 Token 购买搜索额度、模型调用、API 配额等执行资源。</p>
        </div>
        <div className="panel-header-metrics">
          <div className="metric-inline">商品 {items.length}</div>
          <div className="metric-inline">历史订单 {orders.length}</div>
        </div>
      </div>

      <div className="form-panel" style={{ marginBottom: 20 }}>
        <div className="form-grid-two">
          <label className="field-group">
            <span>购买角色</span>
            <select value={buyerAgentId} onChange={(e) => setBuyerAgentId(e.target.value)}>
              {agents.map((agent) => (
                <option key={agent.id} value={`agent_${agent.id}`}>
                  {agent.name} (余额 {agent.walletBalance} Token)
                </option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span>购买数量</span>
            <input
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            />
          </label>
        </div>
      </div>

      <div className="agent-grid">
        {items.map((item) => {
          const totalCost = item.priceToken * quantity
          const balance = selectedAgent?.walletBalance ?? 0
          const canAfford = balance >= totalCost
          const stockOk = item.stockMode === 'infinite' || (item.stockCount !== null && item.stockCount >= quantity)
          const isPurchasing = purchasingItemId === item.id
          const message = feedback[item.id]

          return (
            <div key={item.id} className="agent-card">
              <div className="agent-header">
                <div>
                  <strong>{item.name}</strong>
                  <p>{itemTypeLabels[item.itemType] ?? item.itemType}</p>
                </div>
                <span className="metric-inline">{item.priceToken} Token</span>
              </div>
              <p className="muted">{item.description}</p>
              <div className="agent-stats">
                <span>库存：{item.stockMode === 'infinite' ? '无限' : item.stockCount}</span>
                <span>总计：{totalCost} Token</span>
              </div>
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="approve-button"
                  disabled={!canAfford || !stockOk || isPurchasing}
                  onClick={() => handlePurchase(item.id)}
                  style={{ width: '100%', border: 'none', cursor: canAfford && stockOk ? 'pointer' : 'not-allowed' }}
                >
                  {isPurchasing ? '购买中...' : !canAfford ? '余额不足' : !stockOk ? '库存不足' : `购买 (${totalCost} Token)`}
                </button>
              </div>
              {message && (
                <div className={message.includes('成功') ? 'feedback-banner success' : 'feedback-banner error'} style={{ marginTop: 10 }}>
                  {message}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {orders.length > 0 && (
        <>
          <div style={{ marginTop: 24 }}>
            <p className="eyebrow">购买记录</p>
          </div>
          <div className="stack-list compact-gap">
            {orders.map((order) => (
              <div key={order.id} className="stack-item">
                <strong>{order.buyerName} 购买 {order.itemName} x{order.quantity}</strong>
                <p>{order.totalPrice} Token · {order.status === 'paid' ? '已支付' : order.status} · {order.createdAt}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
