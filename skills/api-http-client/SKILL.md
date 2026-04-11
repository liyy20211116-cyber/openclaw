---
name: api-http-client
description: "当需要调用外部 HTTP API、测试接口、对接第三方服务、发送 webhook 时使用。支持 REST API 请求、响应解析、错误处理。"
metadata: { "openclaw": { "emoji": "🔌", "os": ["win32"] } }
---

# API HTTP Client — HTTP 接口调用与测试

所有角色共享的 HTTP API 交互能力。

## 适用场景

- 调用飞书/ONES 等外部 API
- 测试和调试 REST 接口
- 对接第三方 SaaS 服务
- 发送 Webhook 通知
- 获取远程 JSON/XML 数据

## 可用工具

| 工具 | 用途 | 适用场景 |
|------|------|----------|
| `WebFetch` | GET 请求获取网页/API | 简单 GET 请求 |
| `Shell` + `curl` | 完整 HTTP 客户端 | POST/PUT/DELETE、自定义 Header |
| `Shell` + `python` | Python requests 库 | 复杂流程、需要编程逻辑 |
| 飞书 MCP 工具 | 飞书平台 API | 消息、文档、多维表格 |

## 使用方法

### curl 方式

```powershell
# GET 请求
curl -s "https://api.example.com/data" -H "Authorization: Bearer $token"

# POST JSON
curl -s -X POST "https://api.example.com/create" `
  -H "Content-Type: application/json" `
  -d '{"key": "value"}'

# 带超时
curl -s --connect-timeout 10 --max-time 30 "https://api.example.com/data"
```

### Python 方式

```python
import requests

resp = requests.get("https://api.example.com/data",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30)
resp.raise_for_status()
data = resp.json()
```

### PowerShell 方式

```powershell
$resp = Invoke-RestMethod -Uri "https://api.example.com/data" `
  -Headers @{ "Authorization" = "Bearer $token" } `
  -Method Get -TimeoutSec 30
```

## 常用 API 集成

| 服务 | Base URL | 认证方式 |
|------|----------|----------|
| 飞书开放平台 | `https://open.feishu.cn/open-apis/` | tenant_access_token |
| ONES | `https://{domain}/project/api/` | Cookie + Token |
| 内容流水线 | `http://127.0.0.1:18781/` | 无 |
| KZT 控制塔 | `http://localhost:8000/api/v1/` | 无 |

## 错误处理规范

1. 所有请求必须设置超时（推荐 30 秒）
2. 检查 HTTP 状态码，非 2xx 要处理
3. 解析响应前验证 Content-Type
4. 重试策略：网络错误最多重试 3 次，间隔指数递增
5. 记录失败请求的 URL、状态码、响应体摘要

## 各角色典型用法

| 角色 | 场景 |
|------|------|
| 赫敏 | API 开发测试、服务健康检查、第三方集成 |
| 贾维斯 | 查询各系统状态、触发自动化流程 |
| 卢娜 | 调用内容流水线 API、社媒 API |
| 弗雷德 | CRM API 对接、报价系统查询 |
| 珀西 | 财务系统 API、汇率查询 |

## 注意事项

- API Key/Token 不硬编码，从配置文件或环境变量读取
- 不在日志中打印完整的认证信息
- 注意 API 频率限制（Rate Limit）
- 大量数据请求使用分页
- 生产 API 调用前先在测试环境验证
