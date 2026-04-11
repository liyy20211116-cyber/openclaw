# Jarvis One Company OS — 一人公司智能体系统

基于 OpenClaw 的 AI 公司管理与执行平台。CEO 通过飞书与贾维斯（COO）对话，贾维斯调度 7 个部门完成任务。

## 项目结构

```
D:\FY003\
├── openclaw_agents/        # 核心：8 个部门 Agent + 执行助手
│   ├── jarvis-coo/         # 贾维斯（执行总裁）
│   ├── hermione-tech/      # 赫敏（技术部）
│   ├── mcgonagall-product/ # 麦格教授（产品部）
│   ├── luna-growth/        # 卢娜（内容增长部）
│   ├── fred-sales/         # 弗雷德（销售商务部）
│   ├── percy-finance/      # 珀西（财务部）
│   ├── snape-audit/        # 斯内普（审计风控部）
│   ├── dobby-customer/     # 多比（客户成功部）
│   ├── req-review-agent/   # ONES 需求审核自动化
│   ├── mofashi-workspace/  # 魔法师（执行助手）
│   └── haimian-workspace/  # 海绵（分析助手）
├── skills/                 # 17 个通用基础技能
├── openclaw_skills/        # 4 个 OpenClaw 专用技能
├── config/                 # 公司管理制度
├── jarvis-one-company-os/  # 前端 OS（Electron 桌面端）
├── scripts/                # 业务自动化脚本
├── output/                 # 各部门产出物
└── 归档_历史文档/           # OpenClaw 培训文件和历史备份
```

## 启动方式

```powershell
# 启动 OpenClaw Gateway（贾维斯的运行环境）
openclaw gateway --port 18789 --verbose

# 启动飞书卡片回调服务（ONES 需求审核）
python openclaw_agents/req-review-agent/card_action_handler.py

# 启动一人公司 OS 前端
cd jarvis-one-company-os && npm run dev
```

## 架构

```
CEO（李原野）
 └── 贾维斯（COO · L4）→ 飞书对话入口
      ├── 魔法师 → 执行类任务（开发、数据、自动化）
      ├── 海绵   → 分析类任务（调研、审查、整理）
      └── 7 个部门一号位（通过子代理角色扮演执行）
```

## 核心文档

- `一人公司智能体系统设计文档.md` — 完整系统设计
- `一人公司mvp拆解与cursor任务包.md` — MVP 开发任务
- `config/company-rules.md` — 公司管理制度
- `openclaw_agents/CAPABILITY_MATRIX.md` — 全员能力矩阵
- `openclaw_agents/ORG_CHART.md` — 组织架构
