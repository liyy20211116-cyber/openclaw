---
name: feishu-workflow-diagram
description: "当用户要求把流程可视化、在飞书文档中放流程图、上传流程图图片或图示附件时使用。优先先调用 workflow-diagram-render 生成 Mermaid 产物包；如果已知 doc_token，则同时生成飞书发布计划。"
metadata: { "openclaw": { "emoji": "🧭", "os": ["win32"] } }
---

# Feishu Workflow Diagram

这个 Skill 用于把流程图、架构图、示意图插入飞书文档。

## 适用场景

- 帮我在飞书文档里放一个流程图
- 帮我把这套工作流画出来
- 帮我上传图示到云文档
- 帮我把结构图插到方案文档里

## 推荐链路

当前优先采用下面的安全路线：

1. 先调用 `workflow-diagram-render` 生成产物包
2. 如果已知 `doc_token`，同时让它产出 `*.feishu.json`
3. 如果产物包里已有图片，则优先上传 PNG / SVG 到飞书文档
4. 如果当前没有图片，则上传 `.mmd` / `.txt` 作为附件，并把 `.md` 草稿写进正文
5. 后续若环境具备 Mermaid CLI，可重新跑渲染补齐图片

## 推荐工具

- `workflow-diagram-render`
- `feishu_doc` 的 `write`
- `feishu_doc` 的 `upload_image`
- `feishu_doc` 的 `upload_file`

## 标准动作

### 第一步：先生成图示产物包

```powershell
py -3 "D:\FY003\scripts\workflow_diagram_render.py" --title "需求处理流程" --input "D:\FY003\workspace\workflow_diagram\input\workflow.txt" --output-stem "workflow_main" --render auto --doc-token "doccnxxxxxxxx" --overwrite
```

### 第二步：优先读取飞书发布计划

读取：

- `D:/FY003/workspace/workflow_diagram/output/workflow_main.feishu.json`

其中会包含一组按顺序执行的 `feishu_doc` payload。

### 第三步：没有发布计划时，再手动按顺序执行

1. `write`
2. 有图片就 `upload_image`
3. 无图片就 `upload_file` 上传 `.mmd` / `.txt`

## 工作原则

- 先确认目标文档 token，再上传图像或附件
- 优先读取 `*.feishu.json` 与 `*.upload.json` 决定执行顺序
- 有图片就优先传图片；无图片时不要阻塞整条链，先传附件和正文
- 当前不要承诺“直接编辑飞书原生流程图组件”，除非后续专门补了该能力
- 上传后建议在文档中补一段图示说明和步骤摘要

## 对外回复

完成后告诉用户：

- 图或图示附件已经插入哪个文档
- 上传的是图片还是附件
- 产物包路径
- 是否已经生成飞书发布计划
- 当前是否已经具备图片渲染能力
