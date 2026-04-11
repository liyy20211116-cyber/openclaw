# 一人公司能力矩阵

> 本文件记录全公司角色的技能配置，确保每个角色都具备完成任务所需的全部能力。
> 最后更新：2026-04-10

## 技能体系架构

```
┌─────────────────────────────────────────────────┐
│              角色专属增强技能 (SKILL-*.md)         │
│    贾维斯·赫敏·麦格·卢娜·弗雷德·珀西·斯内普·多比    │
├─────────────────────────────────────────────────┤
│              角色原生技能 (skills.json)            │
│         脚本技能 (skill_*.py) + LLM技能           │
├─────────────────────────────────────────────────┤
│              9大通用基础技能 (skills/)             │
│  搜索·浏览器·文件·技能安装·Git·API·图片·Excel·飞书  │
├─────────────────────────────────────────────────┤
│              飞书工作流技能 (skills/)              │
│  文档·表格·图表·Wiki·云盘·同步·导出·渲染           │
├─────────────────────────────────────────────────┤
│              OpenClaw 技能 (openclaw_skills/)      │
│         内容流水线·委派海绵·委派KZT·委派魔法师       │
└─────────────────────────────────────────────────┘
```

## 9大通用基础技能

所有角色共享，赋予公司全员基础运作能力：

| # | 技能 | 路径 | 核心能力 |
|---|------|------|----------|
| 1 | 网络搜索 | `skills/web-search/` | WebSearch + WebFetch，实时信息获取 |
| 2 | 浏览器自动化 | `skills/browser-automation/` | browser-use + Playwright，网页操控 |
| 3 | 本地文件操作 | `skills/local-file-ops/` | 读写文件、调用本地软件(FFmpeg/Python等) |
| 4 | 技能自安装 | `skills/skill-installer/` | 从GitHub获取技能、依赖管理、技能注册 |
| 5 | Git版本控制 | `skills/git-ops/` | 提交、分支、PR、GitHub仓库操作 |
| 6 | API HTTP客户端 | `skills/api-http-client/` | REST API调用、Webhook、接口测试 |
| 7 | AI图片生成 | `skills/image-gen/` | GenerateImage文字转图、配图素材 |
| 8 | Excel数据处理 | `skills/excel-data/` | 电子表格读写、格式化、报表生成 |
| 9 | 飞书消息通信 | `skills/feishu-messaging/` | 发消息、群管理、通知推送 |

## 各角色技能配置详表

### 贾维斯（COO · 执行办公室）— 权限等级 L4，技能全通

| 技能ID | 技能名 | 类型 | 状态 |
|--------|--------|------|------|
| jarvis_company_status | 公司全局状态 | script | 原有 |
| jarvis_dispatch_tasks | 任务派发执行 | script | 原有 |
| jarvis_daily_report | 生成日报 | llm_to_file | 原有 |
| jarvis_web_research | 网络搜索与情报 | skill_ref | **新增** |
| jarvis_browser_ops | 浏览器自动化 | skill_ref | **新增** |
| jarvis_file_management | 本地文件与软件 | skill_ref | **新增** |
| jarvis_skill_manager | 技能安装与管理 | skill_ref | **新增** |
| jarvis_git_ops | Git 版本控制 | skill_ref | **新增** |
| jarvis_api_client | API HTTP 调用 | skill_ref | **新增** |
| jarvis_image_gen | AI 图片生成 | skill_ref | **新增** |
| jarvis_excel_dashboard | Excel 数据处理 | skill_ref | **新增** |
| jarvis_feishu_msg | 飞书消息通信 | skill_ref | **新增** |
| jarvis_feishu_bitable | 飞书多维表格 | skill_ref | **新增** |
| jarvis_feishu_doc | 飞书文档管理 | skill_ref | **新增** |
| jarvis_feishu_wiki | 飞书知识库 | skill_ref | **新增** |
| jarvis_feishu_drive | 飞书云盘归档 | skill_ref | **新增** |
| jarvis_feishu_sync | 飞书文档同步 | skill_ref | **新增** |
| jarvis_feishu_diagram | 飞书流程图 | skill_ref | **新增** |
| jarvis_doc_export | 文档 PDF 导出 | skill_ref | **新增** |
| jarvis_diagram_render | 流程图渲染 | skill_ref | **新增** |

**专属增强技能**：
- `SKILL-coo-ops.md` — 智能任务调度、技能管理中枢、全局监控仪表盘、网络情报整合
- `SKILL-governance.md` — **CEO授权治理框架**：全公司技能审批、预算分级、权限管理、升级机制

---

### 赫敏·格兰杰（CTO · 技术部）

| 技能ID | 技能名 | 类型 | 状态 |
|--------|--------|------|------|
| hermione_code_review | 代码审查 | script | 原有 |
| hermione_run_test | 运行测试 | script | 原有 |
| hermione_check_services | 检查服务状态 | script | 原有 |
| hermione_deploy_fix | 修复部署问题 | script | 原有 |
| hermione_web_search | 技术文档搜索 | skill_ref | **新增** |
| hermione_browser_test | 浏览器自动化测试 | skill_ref | **新增** |
| hermione_git_ops | Git 版本控制 | skill_ref | **新增** |
| hermione_api_client | API 接口调试 | skill_ref | **新增** |
| hermione_skill_dev | 技能开发部署 | skill_ref | **新增** |
| hermione_file_ops | 文件与脚本执行 | skill_ref | **新增** |

**专属增强技能**：`SKILL-tech-ops.md` — 全栈开发工作流、自动化测试、依赖管理、技能开发工坊、安全编码

---

### 麦格教授（CPO · 产品部）

| 技能ID | 技能名 | 类型 | 状态 |
|--------|--------|------|------|
| mcgonagall_write_prd | 撰写产品需求文档 | llm_to_file | 原有 |
| mcgonagall_acceptance_check | 验收检查 | script | 原有 |
| mcgonagall_requirement_analysis | 需求分析 | script | 原有 |
| mcgonagall_competitive_research | 竞品调研分析 | skill_ref | **新增** |
| mcgonagall_browser_walkthrough | 产品功能走查 | skill_ref | **新增** |
| mcgonagall_flow_diagram | 流程图生成 | skill_ref | **新增** |
| mcgonagall_prototype_image | 原型示意图 | skill_ref | **新增** |
| mcgonagall_data_analysis | 产品数据分析 | skill_ref | **新增** |
| mcgonagall_feishu_doc | 产品文档管理 | skill_ref | **新增** |

**专属增强技能**：`SKILL-product-research.md` — 竞品分析、用户研究、数据驱动决策、产品文档体系

---

### 卢娜·洛夫古德（CGO · 内容增长部）

| 技能ID | 技能名 | 类型 | 状态 |
|--------|--------|------|------|
| luna_content_pipeline | 内容生产流水线 | script | 原有 |
| luna_write_article | 撰写文章 | llm_to_file | 原有 |
| luna_content_stats | 内容产出统计 | script | 原有 |
| luna_trend_research | 热点趋势追踪 | skill_ref | **新增** |
| luna_social_automation | 社媒浏览器操作 | skill_ref | **新增** |
| luna_image_creation | 素材图片生成 | skill_ref | **新增** |
| luna_media_ops | 音视频素材处理 | skill_ref | **新增** |
| luna_content_calendar | 内容排期管理 | skill_ref | **新增** |
| luna_feishu_publish | 飞书内容发布 | skill_ref | **新增** |

**专属增强技能**：`SKILL-growth-ops.md` — 热点追踪、多平台内容生产、视觉素材工坊、SEO优化、增长实验

---

### 弗雷德·韦斯莱（CSO · 销售商务部）

| 技能ID | 技能名 | 类型 | 状态 |
|--------|--------|------|------|
| fred_pricing_proposal | 生成报价方案 | llm_to_file | 原有 |
| fred_customer_analysis | 客户画像分析 | llm_to_file | 原有 |
| fred_sales_stats | 销售数据统计 | script | 原有 |
| fred_prospect_research | 客户网络调研 | skill_ref | **新增** |
| fred_site_analysis | 客户网站分析 | skill_ref | **新增** |
| fred_excel_quotation | Excel 报价单 | skill_ref | **新增** |
| fred_crm_bitable | CRM 客户管理 | skill_ref | **新增** |
| fred_doc_export | 商务文档导出 | skill_ref | **新增** |
| fred_feishu_followup | 飞书商务跟进 | skill_ref | **新增** |
| fred_proposal_image | 方案配图生成 | skill_ref | **新增** |

**专属增强技能**：`SKILL-sales-ops.md` — 客户智能调研、智能报价、CRM管理、商务文档工厂、竞品情报

---

### 珀西·韦斯莱（CFO · 财务部）

| 技能ID | 技能名 | 类型 | 状态 |
|--------|--------|------|------|
| percy_token_report | Token 消耗报告 | script | 原有 |
| percy_budget_check | 预算审核 | script | 原有 |
| percy_project_settlement | 项目结算 | llm_to_file | 原有 |
| percy_excel_report | Excel 财务报表 | skill_ref | **新增** |
| percy_bitable_ledger | 飞书财务台账 | skill_ref | **新增** |
| percy_budget_alert | 预算预警通知 | skill_ref | **新增** |
| percy_market_info | 财务信息查询 | skill_ref | **新增** |
| percy_pdf_export | 报表 PDF 导出 | skill_ref | **新增** |
| percy_file_archive | 财务文件归档 | skill_ref | **新增** |

**专属增强技能**：`SKILL-finance-ops.md` — 自动化Excel报表、飞书财务台账、智能预算预警、ROI分析

---

### 斯内普（CAO · 审计风控部）

| 技能ID | 技能名 | 类型 | 状态 |
|--------|--------|------|------|
| snape_security_scan | 安全扫描 | script | 原有 |
| snape_audit_log | 审计日志检查 | script | 原有 |
| snape_quality_gate | 质量门禁 | llm_to_file | 原有 |
| snape_cve_search | 漏洞情报搜索 | skill_ref | **新增** |
| snape_pentest_browser | 浏览器渗透测试 | skill_ref | **新增** |
| snape_api_security | API 安全测试 | skill_ref | **新增** |
| snape_git_audit | 代码提交审计 | skill_ref | **新增** |
| snape_skill_review | 技能安全审查 | skill_ref | **新增** |
| snape_alert_notify | 安全告警推送 | skill_ref | **新增** |
| snape_file_scanner | 文件系统扫描 | skill_ref | **新增** |

**专属增强技能**：`SKILL-audit-ops.md` — 深度安全扫描、漏洞情报、AI幻觉检测、合规审计、渗透测试

---

### 多比（CCO · 客户成功部）

| 技能ID | 技能名 | 类型 | 状态 |
|--------|--------|------|------|
| dobby_ux_walkthrough | 用户体验走查 | script | 原有 |
| dobby_feedback_summary | 客户反馈汇总 | llm_to_file | 原有 |
| dobby_onboard_guide | 新客户引导 | llm_to_file | 原有 |
| dobby_browser_ux_test | 浏览器 UX 测试 | skill_ref | **新增** |
| dobby_best_practice | 客服最佳实践搜索 | skill_ref | **新增** |
| dobby_customer_notify | 客户消息通知 | skill_ref | **新增** |
| dobby_knowledge_base | 知识库管理 | skill_ref | **新增** |
| dobby_feedback_bitable | 反馈跟踪表 | skill_ref | **新增** |
| dobby_satisfaction_report | 满意度报表 | skill_ref | **新增** |
| dobby_guide_images | 引导配图生成 | skill_ref | **新增** |

**专属增强技能**：`SKILL-customer-ops.md` — 浏览器UX测试、反馈管理、知识库、满意度监控、主动关怀

---

## 能力覆盖矩阵

✅ = 已配置 | ⬜ = 不需要

| 基础能力 | 贾维斯(L4) | 赫敏 | 麦格 | 卢娜 | 弗雷德 | 珀西 | 斯内普 | 多比 |
|----------|:----------:|:----:|:----:|:----:|:------:|:----:|:------:|:----:|
| 网络搜索 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 浏览器自动化 | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ | ✅ | ✅ |
| 本地文件操作 | ✅ | ✅ | ⬜ | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| 技能安装管理 | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| Git版本控制 | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| API HTTP客户端 | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| AI图片生成 | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | ⬜ | ✅ |
| Excel数据 | ✅ | ⬜ | ✅ | ⬜ | ✅ | ✅ | ⬜ | ✅ |
| 飞书消息 | ✅ | ⬜ | ⬜ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 飞书多维表格 | ✅ | ⬜ | ⬜ | ✅ | ✅ | ✅ | ⬜ | ✅ |
| 飞书文档 | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 飞书Wiki | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ |
| 飞书云盘归档 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 飞书文档同步 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 飞书流程图 | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 文档PDF导出 | ✅ | ⬜ | ⬜ | ⬜ | ✅ | ✅ | ⬜ | ⬜ |
| 流程图渲染 | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

> 贾维斯(L4)：全技能覆盖 17/17 ✅ — 其他角色按职能选配

## 技能增长统计

| 角色 | 权限 | 原有技能 | 当前技能 | 增长率 |
|------|------|---------|---------|--------|
| **贾维斯** | **L4 全通** | **3** | **21** | **+600%** |
| 赫敏 | L3 | 4 | 10 | +150% |
| 麦格教授 | L3 | 3 | 9 | +200% |
| 卢娜 | L3 | 3 | 9 | +200% |
| 弗雷德 | L3 | 3 | 10 | +233% |
| 珀西 | L3 | 3 | 9 | +200% |
| 斯内普 | L3 | 3 | 10 | +233% |
| 多比 | L3 | 3 | 10 | +233% |
| **全公司** | — | **25** | **88** | **+252%** |

## 文件清单

### 新增通用技能（9个）
- `skills/web-search/SKILL.md`
- `skills/browser-automation/SKILL.md`
- `skills/local-file-ops/SKILL.md`
- `skills/skill-installer/SKILL.md`
- `skills/git-ops/SKILL.md`
- `skills/api-http-client/SKILL.md`
- `skills/image-gen/SKILL.md`
- `skills/excel-data/SKILL.md`
- `skills/feishu-messaging/SKILL.md`

### 新增角色专属技能（9个）
- `openclaw_agents/jarvis-coo/SKILL-coo-ops.md`
- `openclaw_agents/jarvis-coo/SKILL-governance.md` — **CEO授权治理框架**
- `openclaw_agents/hermione-tech/SKILL-tech-ops.md`
- `openclaw_agents/mcgonagall-product/SKILL-product-research.md`
- `openclaw_agents/luna-growth/SKILL-growth-ops.md`
- `openclaw_agents/fred-sales/SKILL-sales-ops.md`
- `openclaw_agents/percy-finance/SKILL-finance-ops.md`
- `openclaw_agents/snape-audit/SKILL-audit-ops.md`
- `openclaw_agents/dobby-customer/SKILL-customer-ops.md`

### 更新文件（8个 skills.json）
- 所有 8 个角色的 `skills.json` 均已更新，注册新增技能
