---
name: skill-installer
description: "当需要为公司角色安装新技能、从 GitHub 获取技能包、更新现有技能、管理技能依赖时使用。支持从 GitHub 仓库克隆技能并集成到 OpenClaw 体系。"
metadata: { "openclaw": { "emoji": "📦", "os": ["win32"] } }
---

# Skill Installer — 技能自安装与管理

所有角色共享的技能获取和自我进化能力。

## 适用场景

- 从 GitHub 仓库安装新技能
- 更新现有技能到最新版本
- 创建自定义技能并注册到角色
- 检查技能依赖和兼容性
- 技能健康检查和修复

## 技能安装流程

### 从 GitHub 安装

```powershell
# 1. 克隆技能仓库
git clone https://github.com/{org}/{repo}.git temp_skill

# 2. 检查技能结构
#    必须包含 SKILL.md，可选 requirements.txt、*.py 等

# 3. 复制到目标目录
Copy-Item -Recurse temp_skill\{skill-name} skills\{skill-name}

# 4. 安装依赖（如有）
pip install -r skills\{skill-name}\requirements.txt

# 5. 清理临时文件
Remove-Item -Recurse temp_skill
```

### 从现有模板创建

1. 在 `skills/` 下创建新目录
2. 编写 `SKILL.md`（必须包含 YAML front matter）
3. 编写执行脚本（如需要）
4. 注册到对应角色的 `skills.json`

## 技能文件规范

### SKILL.md 必须结构

```yaml
---
name: skill-name
description: "触发条件描述"
metadata: { "openclaw": { "emoji": "🔧", "os": ["win32"] } }
---
```

正文必须包含：
- 适用场景
- 使用流程（分步骤）
- 注意事项

### skills.json 注册格式

```json
{
  "id": "agent_skill_name",
  "name": "技能显示名",
  "description": "技能用途描述",
  "type": "script|llm_to_file|http",
  "script": "skill_xxx.py",
  "timeout": 60
}
```

## GitHub 技能源推荐

| 类别 | 推荐仓库/方向 | 用途 |
|------|---------------|------|
| AI Agent 框架 | langchain, autogen, crewai | Agent 协作模式参考 |
| 浏览器自动化 | playwright, puppeteer | 网页自动化脚本 |
| 数据处理 | pandas, polars | 数据清洗和分析 |
| 内容生成 | openai, anthropic SDK | LLM 调用增强 |
| 飞书集成 | lark-sdk, feishu-openapi | 飞书 API 封装 |
| 安全扫描 | bandit, safety, trivy | 代码安全检测 |
| 文档处理 | python-docx, reportlab | 文档生成和转换 |

## 技能健康检查

```powershell
# 检查所有技能文件完整性
Get-ChildItem -Recurse skills\*\SKILL.md | ForEach-Object {
    $name = $_.Directory.Name
    $hasYaml = (Get-Content $_.FullName -Head 1) -eq "---"
    Write-Host "$name : YAML=$hasYaml"
}
```

## 升级流程

1. 备份当前技能文件
2. 从源拉取最新版本
3. 对比差异确认无破坏性变更
4. 替换文件
5. 运行健康检查
6. 通知贾维斯更新完成

## 各角色典型用法

| 角色 | 场景 |
|------|------|
| 赫敏 | 安装新的开发工具链技能、更新 API 对接技能 |
| 贾维斯 | 为各部门安装新能力、统筹技能升级 |
| 斯内普 | 安装安全扫描新规则、更新漏洞库 |
| 卢娜 | 安装新的内容平台对接技能 |

## 注意事项

- 安装前检查仓库星标数和最近更新时间
- 不安装来路不明的技能，优先用官方/知名仓库
- 安装后由斯内普做安全审查
- 保持技能版本记录，便于回滚
- Python 依赖优先安装到项目虚拟环境
