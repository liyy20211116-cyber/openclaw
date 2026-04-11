---
name: workflow-diagram-render
description: "当用户要求把流程、步骤、SOP、任务链画成图时使用。当前会先安全生成 Mermaid 源文件、步骤摘要、飞书文档草稿和上传清单；若环境中已安装 Mermaid CLI，则自动补出图片；若提供 doc_token，则额外生成飞书发布计划。"
metadata: { "openclaw": { "emoji": "📈", "os": ["win32"], "requires": { "anyBins": ["python", "py"] } } }
---

# Workflow Diagram Render

这个 Skill 用于把工作流文本转换成一组可复用产物。

## 适用场景

- 帮我把流程画成图
- 帮我把步骤转成 Mermaid
- 帮我先产出流程图源文件
- 帮我生成后续可上传到飞书文档的图示素材
- 帮我生成飞书文档上传计划

## 安全边界

必须严格遵守：

1. 输入文件只允许放在 `D:\FY003\workspace\workflow_diagram\input`
2. 输出文件只允许写到 `D:\FY003\workspace\workflow_diagram\output`
3. 默认优先生成安全的文本产物；只有在检测到 Mermaid CLI 时才补图片
4. 不执行任意未知外部渲染命令，仅自动探测 `mmdc`

## 默认产物

每次执行至少会生成：

- `.mmd`：Mermaid 源文件
- `.txt`：步骤摘要
- `.md`：飞书文档正文草稿
- `.upload.json`：上传顺序和产物清单

如果传入 `--doc-token`，还会额外生成：

- `.feishu.json`：可直接喂给 `feishu_doc` 的操作计划

如果环境里已安装 Mermaid CLI（`mmdc`），还会额外生成：

- `.png` 或 `.svg`

## 执行方式

先把流程步骤写入一个 UTF-8 文本文件，每行一步，例如：

```text
明确需求
拆解任务
执行与跟进
验收与复盘
```

然后执行：

```powershell
py -3 "D:\FY003\scripts\workflow_diagram_render.py" --title "需求处理流程" --input "D:\FY003\workspace\workflow_diagram\input\workflow.txt" --output-stem "workflow_main" --render auto --doc-token "doccnxxxxxxxx" --overwrite
```

## 渲染模式

- `--render auto`：默认模式；若发现 `mmdc` 就生成 PNG，否则只生成文本产物
- `--render none`：只生成文本产物
- `--render png` / `svg` / `both`：强制输出图片；若没装 `mmdc` 会直接报错

## 返回结果

脚本会输出 JSON，重点关注：

- `mermaid_file`
- `summary_file`
- `doc_markdown_file`
- `upload_manifest_file`
- `feishu_publish_plan_file`
- `rendered_files`
- `renderer`

## 与飞书联动

如果用户还要求“放进飞书文档”：

1. 先使用本 Skill 生成产物包
2. 如果传入了 `--doc-token`，优先读取 `*.feishu.json`
3. 如果 `rendered_files` 非空，优先上传图片到飞书文档
4. 同时把 `.md` 草稿内容写入文档正文
5. 如果还没有图片，则先上传 `.mmd` 或 `.txt` 作为附件

## 建议上传路径

- Mermaid 源文件：`D:\FY003\workspace\workflow_diagram\output\*.mmd`
- 步骤摘要：`D:\FY003\workspace\workflow_diagram\output\*.txt`
- 文档草稿：`D:\FY003\workspace\workflow_diagram\output\*.md`
- 上传清单：`D:\FY003\workspace\workflow_diagram\output\*.upload.json`
- 飞书计划：`D:\FY003\workspace\workflow_diagram\output\*.feishu.json`
- 图片文件（若有）：`D:\FY003\workspace\workflow_diagram\output\*.png` / `*.svg`

## 对外回复

默认告诉用户：

- 已生成哪些产物
- 文件路径
- 当前是否已具备图片渲染能力
- 是否已经生成飞书发布计划
- 下一步应优先上传图片还是附件
