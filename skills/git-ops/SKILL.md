---
name: git-ops
description: "当需要进行版本控制操作（提交、分支、合并、查看历史、克隆仓库）或从 GitHub 获取代码/资源时使用。"
metadata: { "openclaw": { "emoji": "🔀", "os": ["win32"] } }
---

# Git Ops — 版本控制与 GitHub 操作

所有角色共享的 Git 版本控制能力。

## 适用场景

- 代码版本管理（提交、分支、合并）
- 从 GitHub 克隆仓库、获取资源
- 查看变更历史和差异
- 创建 Pull Request
- 发布 Release

## 常用命令

### 基础操作

```powershell
git status                    # 查看当前状态
git diff                      # 查看未暂存的修改
git add .                     # 暂存所有修改
git commit -m "message"       # 提交
git log --oneline -20         # 查看最近20条提交
```

### 分支管理

```powershell
git branch                    # 列出本地分支
git checkout -b feature/xxx   # 创建并切换分支
git merge feature/xxx         # 合并分支
git branch -d feature/xxx     # 删除已合并分支
```

### 远程操作

```powershell
git clone https://github.com/{org}/{repo}.git
git pull origin main
git push origin HEAD
```

### GitHub CLI (gh)

```powershell
gh repo list {org}            # 列出组织仓库
gh pr create --title "xxx"    # 创建 PR
gh pr list                    # 列出 PR
gh issue list                 # 列出 Issue
gh release list               # 列出 Release
```

## 分支策略

```
main ──────────────────────── 生产分支
  └── develop ──────────────── 开发分支
        ├── feature/xxx ────── 功能分支
        ├── fix/xxx ────────── 修复分支
        └── skill/xxx ──────── 技能开发分支
```

## 提交规范

```
类型(范围): 描述

feat(agent): 新增赫敏的 API 测试技能
fix(skill): 修复内容流水线超时问题
docs(org): 更新组织架构能力矩阵
chore(deps): 更新 playwright 依赖
```

## 各角色典型用法

| 角色 | 场景 |
|------|------|
| 赫敏 | 代码版本管理、CR、分支策略执行 |
| 贾维斯 | 查看项目进度、审批合并请求 |
| 斯内普 | 审查提交历史、检测敏感信息泄露 |
| 卢娜 | 管理内容资产版本 |

## 注意事项

- 不要在 commit 中包含密钥、token 等敏感信息
- 推送前先 pull，避免冲突
- 不对 main 分支强制推送
- 大文件（>50MB）使用 Git LFS
- 保持 .gitignore 更新，排除临时文件和缓存
