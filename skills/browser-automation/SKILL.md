---
name: browser-automation
description: "当需要操作网页界面、自动化表单填写、网页截图、UI测试、模拟用户操作时使用。通过 browser-use 子代理或 Playwright 实现浏览器自动化。"
metadata: { "openclaw": { "emoji": "🌐", "os": ["win32"] } }
---

# Browser Automation — 浏览器自动化

所有角色共享的浏览器操控能力。

## 适用场景

- 自动化网页操作（填表、点击、导航）
- 网页截图和视觉验证
- Web UI 功能测试和回归测试
- 从需要登录的系统中提取数据
- 模拟用户操作流程走查
- 监控网页变化

## 可用工具

| 工具 | 用途 | 备注 |
|------|------|------|
| `browser-use` 子代理 | 完整浏览器自动化 | 支持导航、点击、填写、截图 |
| Playwright (via Shell) | 脚本化浏览器测试 | `npx playwright` 命令行 |

## 使用 browser-use 子代理

通过 Task 工具启动 `browser-use` 类型的子代理：

```
subagent_type: "browser-use"
prompt: "导航到 {URL}，执行 {操作}，截图确认结果"
```

子代理能力：
- 打开 URL 并等待页面加载
- 点击按钮、链接、菜单项
- 填写输入框、下拉选择
- 截取整页或局部截图
- 读取页面文本内容
- 处理弹窗和确认框

## 使用 Playwright 脚本

适合需要精确控制的自动化场景：

```powershell
npx playwright test {test-file.spec.ts}
```

或用 Python：
```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://example.com")
    page.screenshot(path="screenshot.png")
    browser.close()
```

## 各角色典型用法

| 角色 | 典型场景 |
|------|----------|
| 赫敏 | 自动化测试 Web 应用、API 调试面板操作 |
| 麦格教授 | 竞品网站功能走查、截图对比 |
| 卢娜 | 社媒平台数据采集、内容发布辅助 |
| 弗雷德 | 客户网站调研、CRM 系统操作 |
| 斯内普 | 安全测试、XSS/CSRF 检测、权限验证 |
| 多比 | 用户体验走查、流程截图、Bug 复现 |

## 注意事项

- 浏览器自动化依赖本地 Chromium，首次使用需安装
- 不要在自动化中输入真实密码，优先用 token/cookie
- 高风险操作（删除、支付）需人工确认
- 截图保存到 `output/screenshots/` 目录
- 遵守目标网站的 robots.txt 和使用条款
