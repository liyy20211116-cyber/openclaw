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
