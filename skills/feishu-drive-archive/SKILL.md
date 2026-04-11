---
name: feishu-drive-archive
description: "当用户要求把文档、PDF、图片、项目输出物归档到飞书云盘目录时使用。优先使用 feishu_drive 创建目录、移动文件，并保持目录结构清晰。"
metadata: { "openclaw": { "emoji": "🗂️", "os": ["win32"] } }
---

# Feishu Drive Archive

用于把产出物归档到飞书云盘共享目录。

## 适用场景

- 帮我归档到云盘
- 帮我整理飞书文件夹
- 帮我把生成的文档移到项目目录
- 帮我建立项目归档目录结构

## 推荐工具

- `feishu_drive`

## 常用动作

### 查看目录

```json
{ "action": "list", "folder_token": "fldcnXXX" }
```

### 创建子目录

```json
{ "action": "create_folder", "name": "项目归档", "folder_token": "fldcnXXX" }
```

### 移动文件

```json
{ "action": "move", "file_token": "file_token", "type": "docx", "folder_token": "fldcnXXX" }
```

## 工作原则

- 机器人没有自己的根目录，必须在用户已共享的目录内操作
- 优先保持目录命名统一，例如：项目名 / 日期 / 产物类型
- 归档前先确认目标目录，不要随意删除文件
- `delete` 属于高风险操作，除非用户明确要求，否则不要主动执行

## 适合归档的内容

- 飞书文档
- PDF
- 图片和图示
- 附件文件
- 项目阶段性产物

## 对外回复

完成后告诉用户：

- 已归档到哪个目录
- 是否新建了子目录
- 涉及哪些文件
