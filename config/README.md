# Jarvis OS 配置中心

> 本目录是 Jarvis One Company OS 的统一配置入口。
> 遵循「多租户 + JSON Schema + 分层覆盖」架构。

## 目录结构

```
config/
├── tenant/                  # 多租户目录
│   ├── default/             # 默认租户 = CEO 自己
│   │   ├── tenant.json      # 租户元信息
│   │   ├── branding.json    # 品牌（产品名/Logo/配色/Agent 昵称）
│   │   ├── commerce.json    # 商业化（定价 SKU / 支付账号 / 发票）
│   │   ├── features.json    # Feature Flag（套餐能力开关）
│   │   ├── token-economy.json  # 9 AI 员工的工资预算 / KPI
│   │   └── integrations/    # 第三方账号凭证（M2 后加密）
│   └── <tenant_id>/         # 客户独立租户（产品化后动态创建）
│
├── schemas/                 # JSON Schema 校验
│   ├── tenant.schema.json
│   ├── branding.schema.json
│   ├── commerce.schema.json
│   ├── features.schema.json
│   └── token-economy.schema.json
│
├── knowledge/               # 公共知识库（迁移自旧版）
├── company-rules.md         # 公司制度（迁移）
├── company-culture.md       # 公司文化（迁移）
└── README.md                # 本文件
```

## 分阶段路线（v1 M1 已完成）

- ✅ **M1 骨架**（本版本）：目录结构 + 5 个 schema + default 租户
- 🟡 **M2 迁移**（下一步）：把 `.env` / `config/knowledge/*.md` / `config/payment-info.json` 统一映射进来
- ⏳ **M3 多租户化**：新增 `scripts/tenant_cli.py` 管理多租户；打开 SaaS 路线

## 使用指南

### 1. 读取配置

```python
from pathlib import Path
import json

CONFIG_ROOT = Path("config")
TENANT_ID = "default"

def load_tenant_config(name: str, tenant: str = TENANT_ID) -> dict:
    p = CONFIG_ROOT / "tenant" / tenant / f"{name}.json"
    return json.loads(p.read_text(encoding="utf-8"))

branding = load_tenant_config("branding")
features = load_tenant_config("features")
```

### 2. 校验配置

```bash
# 安装：pip install jsonschema
python scripts/config_validate.py
```

（`config_validate.py` 在 M2 阶段开发）

### 3. 按 Feature Flag 启用 Skill

```python
if features["skills"].get("wechat-bot"):
    # 加载微信 Skill
    ...
```

## 敏感信息

- 当前 M1 阶段所有 JSON 为明文，建议：
  - 真实 API Key / Token 走 `.env`（已 gitignore）
  - integrations/ 内的 json 文件里只放占位
- M2 阶段：引入 `config/secrets/` 加密目录（Windows DPAPI / 云 KMS）
- **禁止** 把真实支付信息 / API Key 提交到 git

## Feature Plans 速查

| Plan | 月预算 LLM | Agent 数 | Pack | 可选能力 |
|---|---|---|---|---|
| starter | ¥100 | 3 | 1 | 仅核心 |
| pro | ¥500 | 5 | 3 | 内容+视频+微信 |
| enterprise | 不限 | 9+ | 全部 | 全量 |
| internal | 不限 | 9+ | 全部 | CEO 自用版 |
