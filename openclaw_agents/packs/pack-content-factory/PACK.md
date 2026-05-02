---
name: pack-content-factory
description: "自媒体内容工厂 Pack —— 5 只 AI 虾分工协作，把一个主题从热点选题到多平台发布全自动化。对标：拉斐尔2077 5 虾阵、videocut 流水线、阿森 AI 军团。"
version: 0.1
emoji: 🏭
---

# Pack · 自媒体内容工厂

一人公司最高频的业务形态：日更内容、多平台分发、持续涨粉、产出 IP 资产。

本 Pack 把 Jarvis OS 的 9 部门 Agent **裁剪**为 5 个专职角色，全部聚焦"内容生产"链路。

## 5 只虾（5 个子 Agent）

| # | 角色 | 英文 | 对应 Jarvis 主 Agent | 核心职责 |
|---|---|---|---|---|
| 1 | **选题虾** | `selection-agent` | Luna-growth（精简） | 抓热点 / 对标账号增量 / 生成选题池 |
| 2 | **写作虾** | `writing-agent` | Luna-growth（深化） | 写脚本 / 文案 / 小红书图文 / 口播稿 |
| 3 | **审核虾** | `review-agent` | Snape-audit（精简） | 合规检查 / 口误识别 / 事实校对 / KPI 预测 |
| 4 | **生产虾** | `production-agent` | Hermione-tech + 魔法师 | 调 videocut / openclip / TTS 生成视频 |
| 5 | **分发虾** | `distribution-agent` | Luna-growth + 魔法师 | 多平台发布 / 排期 / 数据回收 |

## 典型工作流（DAG）

```
                          ┌─ 抖音适配稿
选题虾 → 写作虾 → 审核虾 → 生产虾 ─┼─ 小红书图文
  ↑                                ├─ B站长视频
  └─(数据回流)────── 分发虾 ←──────┴─ 公众号文章
```

## 关键数据文件

```
packs/pack-content-factory/
├── PACK.md                     # 本文件
├── workflow.json               # DAG 工作流定义（后续实装）
├── selection-agent/IDENTITY.md
├── writing-agent/IDENTITY.md
├── review-agent/IDENTITY.md
├── production-agent/IDENTITY.md
├── distribution-agent/IDENTITY.md
└── shared/
    ├── content-templates/      # 模板库
    ├── topic-pool.json         # 选题池（由选题虾每日更新）
    └── publish-calendar.json   # 发布排期
```

## 关键集成点

- **数据输入**：`skills/opencli-bridge/scripts/hot_aggregator.py` 每天 9 点自动喂选题虾
- **视频生产**：`skills/video-edit-cli/scripts/pipeline_koubo.py` 编排 videocut 7 能力
- **TTS**：`skills/video-edit-cli/scripts/wrap_tts.py` 文字转语音
- **长视频二创**：`skills/video-edit-cli/scripts/wrap_openclip.py` 抓爆款直播提取高光
- **对标监控**：`skills/opencli-bridge/scripts/competitor_monitor.py` 追踪 12 个 Top 博主
- **发布到微信**：`skills/wechat-bot/scripts/wx_send.py`
- **飞书通知**：`skills/feishu-messaging/`

## 启动方式（规划）

```powershell
# 进入 Pack 模式
jarvis pack activate pack-content-factory

# 一键生产今日内容
jarvis pack run content-factory --topic "AI 一人公司" --platforms douyin,xhs,bilibili
```

## 首周 KPI

| 指标 | 目标 |
|---|---|
| 生产内容数 | ≥ 15 条（3 平台 × 5 天） |
| 单条最高播放 | ≥ 1,000 |
| 平均制作工时 | ≤ 30 分钟/条（全自动） |
| CEO 手工干预率 | ≤ 20% |

## 与通用 9 部门的关系

- Pack 不取代原 Agent，只是**场景化预设**
- 激活 Pack 后，Jarvis-COO 自动把对话路由到这 5 虾
- CEO 可随时 `jarvis pack deactivate` 回到完整 9 部门模式
