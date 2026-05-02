# 赫敏（技术部）长期记忆

---
_2026-04-10 02:00_ 【当前项目】ONES 需求审核自动化 - 技术状态

## 代码位置
d:\FY003\openclaw_agents\req-review-agent\

## 已完成
- scan_and_send.py：扫描飞书多维表格"待审批"记录，发送审核卡片 ✅
- card_action_handler.py：飞书 WebSocket 长连接监听卡片回调，处理通过/退回 ✅
- create_ones_task_ui.py：Playwright UI 自动化在 ONES 页面创建工作项 ✅
- ones_token_refresh.py：WIS SSO 自动获取 ONES Token ✅
- config.json：所有 UUID 映射已完成 ✅

## 技术架构
- Playwright + CDP 连接本机 Edge 浏览器（端口 9337 或 18800）
- ONES API 有 IssueTypeScope 限制，所以改用 UI 自动化
- 飞书用两个应用：原神（卡片交互）、白泽（Bitable 读写）
- Token 缓存在 token_cache.json，JWT 有效期约 1 小时

## 待验证
- 端到端流程：点击通过→建单→回写的完整链路未经过正式测试
- processed_log.json 为空，说明还没有成功案例
- 需要启动 card_action_handler.py 和本机 Edge CDP 后做实测

---
_2026-04-14 00:00_ 【项目更新】ONES 自动化内测项目 - 技术待办

## 紧急修复项
1. Token 过期后的自动重试机制（create_ones_task_ui.py 需在建单失败时调用 ones_token_refresh.py 刷新后重试）
2. card_action_handler.py 中异常捕获需显式记录日志，消除静默失败
3. processed_log.json 写入逻辑验证（确认是否有写入权限/路径问题）

## 端到端测试计划
1. 启动 Edge CDP（端口 9337）
2. 运行 ones_token_refresh.py 获取有效 Token
3. 启动 card_action_handler.py（WebSocket 长连接）
4. 从 pending_reviews.json 取一条记录手动触发"通过"
5. 验证 ONES 工作项是否创建成功
6. 验证飞书表格是否回写 ONES 链接和编号
7. 验证 processed_log.json 是否正确记录

## 注意
代码位置：`d:\FY003\openclaw_agents\req-review-agent\`
此项目是一人公司的内测交付项目，代码不在产品本体中，而是独立运行的 Python 服务。

---
_2026-04-29_ 【7 天游号实验自动化缺口】

- 需要可复用监控表：平台、标题、状态、阅读、点赞、收藏、评论、私信、线索、下一步。
- 需要评论/私信读取或人工录入入口，先人工审核，后续再做低风险自动化。
- 需要把内容草稿、发布日志、线索分级、财务记录统一回写到一人公司 OS。

---
_2026-04-29_ 【内容风险预防能力】

- 已新增小红书合规闸门 `scripts/xhs_compliance_guard.py`，可拦截互动诱导、硬广收益承诺和抽象 AI 味。
- 已新增 Day2 草稿生成器 `scripts/xhs_day2_reflection.py`，生成前必须通过测试。
- 技术岗不能只做发布后监控，还要把事故复盘沉淀为发布前预防。
