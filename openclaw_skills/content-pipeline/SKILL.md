---
name: content-pipeline
description: 当用户想要生成今日财经视频、日报简报、新闻脚本，或要求"出片""全流程""跑一下日报"时，调用本地内容生产流水线 API，驱动 fetch_news → rank_news → write_script → build_video 全链路自动执行。
---

# 内容生产流水线技能

## 触发条件

以下任意一种情况，立即使用本技能：

- 用户提到「生成今天视频」「今日财经视频」「财经简报」「出片」
- 用户提到「跑日报」「日报流程」「拉新闻」「生成脚本」
- 用户提到「全流程」「一键生产」「run all」「内容流水线」
- 用户直接说「开始」「生成」且上下文是内容生产场景

**不触发本技能的情况：** 普通闲聊、非内容生产相关的问题、其他业务系统查询。

---

## 流水线步骤说明

| step 值  | 执行内容                                            | 耗时估算 |
|---------|-----------------------------------------------------|---------|
| `all`   | 完整流程：fetch + rank + write_script + build_video  | 60~90 秒 |
| `daily` | 仅文字部分：fetch + rank + write_script              | 10~20 秒 |
| `video` | 仅视频渲染：需先跑过 daily，直接从已有脚本出片       | 40~60 秒 |
| `fetch` | 仅抓取 BBC/Reuters RSS                              | 5~10 秒  |
| `rank`  | 仅筛选 Top 8 新闻                                   | <1 秒   |
| `script`| 仅生成文字脚本                                      | <1 秒   |

---

## API 调用方式

本地流水线 API 运行在 `http://127.0.0.1:18781`，使用 HTTP Tool 调用。

### 第一步：启动任务

```
POST http://127.0.0.1:18781/run
Content-Type: application/json

{"step": "all"}
```

响应示例（任务已启动）：
```json
{
  "status": "running",
  "step": "all",
  "started_at": "2026-03-14T09:00:00"
}
```

### 第二步：轮询任务状态

启动后根据 step 等待相应时间，再调用：

```
GET http://127.0.0.1:18781/status
```

- `daily` 步骤：等待 **20 秒** 后查询
- `all` / `video` 步骤：等待 **70 秒** 后查询
- 若返回 `"status": "running"`，再等 20 秒后重试，最多重试 **4 次**
- 若 4 次后仍 running，告知用户正在生成中，稍后可再查询

### 第三步：读取产出

状态变为 `"done"` 时，响应中含 `outputs` 字段：

```json
{
  "status": "done",
  "elapsed_sec": 72.3,
  "outputs": {
    "script_path": "D:\\FY003\\output\\script_today_20260314.txt",
    "script_content": "Daily Finance Brief 20260314\n\nTop headlines:\n\n1. ...",
    "video_path": "D:\\FY003\\output\\publish_bundle_20260314\\finance_brief_20260314.mp4",
    "video_size_kb": 3241
  }
}
```

---

## 结果回复规范

任务成功后，向用户输出：

1. **今日简报正文**（`script_content` 的全文，逐条展示）
2. **视频文件路径**（如有，说明文件大小）
3. **耗时**（`elapsed_sec`）

若任务失败（`"status": "error"`），把 `stderr` 中的关键信息转述给用户，并建议排查方向（网络、Python 环境、FFmpeg）。

---

## 健康检查（可选）

如果不确定 API 服务是否在运行，先检查：

```
GET http://127.0.0.1:18781/health
```

若连接失败，告知用户：「内容生产服务尚未启动，请运行 `scripts\start_pipeline_api.bat`，或重启 OpenClaw（会自动拉起服务）。」

---

## 典型对话示例

**用户**：帮我生成今天的财经视频

**你应该**：
1. 告知用户「好，启动完整流水线，包含新闻抓取、筛选、脚本生成和视频渲染，大约需要 60~90 秒」
2. 调用 `POST /run {"step": "all"}`
3. 等待 70 秒
4. 调用 `GET /status`，若 done 则展示简报内容和视频路径
5. 若仍 running，再等 20 秒重试

**用户**：先出脚本，视频等我确认再出

**你应该**：
1. 调用 `POST /run {"step": "daily"}`
2. 等待 20 秒后 `GET /status`
3. 把 `script_content` 完整展示给用户，等待确认
4. 用户确认后，再调用 `POST /run {"step": "video"}`
