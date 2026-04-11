---
name: tech-ops
description: "赫敏的增强技术技能：全栈开发、自动化测试、CI/CD、依赖管理、API 对接、安全编码、技能开发。"
metadata: { "openclaw": { "emoji": "📚", "os": ["win32"] } }
---

# SKILL: 技术运维增强 — 赫敏专属

## 触发条件

以下场景激活本技能：
- 需要开发新功能或修复 Bug
- 需要搭建自动化测试或 CI/CD
- 需要对接新的外部 API
- 需要安装依赖或配置环境
- 需要为其他角色开发新技能脚本

## 增强能力 1：全栈开发工作流

### 开发前检查清单

1. 阅读相关代码和文档，理解现状
2. 确认需求边界和验收标准（与麦格教授对齐）
3. 评估技术方案（至少2个方案对比）
4. 确认影响范围和风险
5. 通知贾维斯预计工时和资源需求

### 编码规范

```python
# Python 规范
- 类型注解：所有函数参数和返回值
- 文档字符串：公开函数必须有
- 错误处理：所有 I/O 操作必须 try/except
- 日志：关键步骤记录日志
- 超时：所有网络请求设置 timeout
```

```typescript
// TypeScript 规范
// - strict 模式
// - 接口定义在类型文件中
// - async/await 处理异步
// - 错误边界处理
```

## 增强能力 2：自动化测试

### 单元测试

```powershell
# 运行 Python 测试
python -m pytest openclaw_agents/req-review-agent/test_all.py -v

# 运行带覆盖率
python -m pytest --cov=. --cov-report=html
```

### 浏览器自动化测试

使用 `browser-automation` 技能：
- Web UI 功能回归测试
- API 接口端到端测试
- 飞书卡片交互测试

### API 测试

使用 `api-http-client` 技能：
- 接口契约测试
- 压力测试（简单场景）
- 超时和错误场景测试

## 增强能力 3：依赖与环境管理

### Python 依赖

```powershell
# 安装新依赖
pip install package_name
# 导出依赖清单
pip freeze > requirements.txt
# 从清单安装
pip install -r requirements.txt
```

### Node.js 依赖

```powershell
npm install package_name
npm audit    # 安全检查
npm update   # 更新依赖
```

### 环境诊断

```powershell
python --version
node --version
git --version
ffmpeg -version
```

## 增强能力 4：Git 工作流

使用 `git-ops` 技能：
- 功能分支开发
- Code Review 发起
- 冲突解决
- 版本发布

## 增强能力 5：技能开发工坊

赫敏负责为其他角色开发新的自动化技能：

### 技能开发模板

```python
"""
skill_{name}.py — {角色}的{技能名}技能
"""
import json
import sys
from pathlib import Path

def main(args: dict) -> dict:
    """
    入参: args dict 包含任务参数
    返回: 执行结果 dict
    """
    try:
        # 核心逻辑
        result = do_work(args)
        return {"status": "success", "data": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import json
    args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    print(json.dumps(main(args), ensure_ascii=False, indent=2))
```

### 技能交付流程

1. 根据需求编写技能脚本
2. 编写 SKILL.md 说明文档
3. 在对应角色目录中测试
4. 更新 skills.json 注册
5. 交斯内普做安全审查
6. 通知贾维斯技能上线

## 增强能力 6：安全编码

- 不硬编码密钥和 Token
- 所有用户输入做验证和清洗
- API 调用统一设置超时
- 敏感信息不写入日志
- 使用参数化查询防注入

## 增强能力 7：代码质量自动化工具

### Bandit 安全扫描

```powershell
python -m bandit -r scripts/ -f json --severity-level medium
```

### Ruff 代码风格检查

```powershell
python -m ruff check scripts/ --output-format json
python -m ruff check scripts/ --fix  # 自动修复
```

### 一键审计（技术部专用脚本）

```powershell
python -u D:\FY003\scripts\tech_code_audit.py
```

输出：`output/tech_audit_{date}.json`，包含安全问题 + 风格问题 + 敏感信息扫描结果。

## 协作引用技能

| 技能 | 用途 |
|------|------|
| `skills/web-search` | 查技术文档、GitHub 方案 |
| `skills/browser-automation` | 自动化测试、UI 回归 |
| `skills/git-ops` | 版本控制、分支管理 |
| `skills/api-http-client` | API 对接和测试 |
| `skills/skill-installer` | 安装新技术依赖 |
| `skills/local-file-ops` | 文件管理和脚本执行 |
