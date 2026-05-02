---
name: video-edit-cli
description: "AI 口播视频剪辑流水线 Skill：对接 zinan92/videocut（去废话+字幕+金句+拆条+封面+变速）、linzzzzzz/openclip（长视频高光提取）、WtecHtec/Clip2Post（视频转文章+文字转视频+TTS），支撑 Luna/魔法师的自媒体生产线。"
metadata: { "openclaw": { "emoji": "🎬", "os": ["win32"] } }
---

# Video Edit CLI — 视频剪辑全流水线

面向一人公司的「口播视频→成片」CLI 能力集。整合目前最活跃的 3 个开源项目，Jarvis 的 Luna/魔法师 可直接调用。

## 为什么需要

- 抖音头部博主（阿森、拉斐尔 2077、小天 fotos）都靠"5 虾阵+剪辑流水线"月更百条
- Jarvis 现有 `content-pipeline` 只做文字，缺视频环节
- 补齐后 Luna 可 **一键：热点 → 脚本 → 口播录制 → 剪辑 → 字幕 → 封面 → 多平台分发**

## 对接的开源项目

| 项目 | GitHub | Stars | 核心能力 | 在本 Skill 的定位 |
|---|---|---|---|---|
| **videocut** | zinan92/videocut | 新秀 | 去废话/字幕/金句/拆条/封面/变速 (7 CLI) | **主力**：口播粗剪 |
| **openclip** | linzzzzzz/openclip | 164 | 长视频高光提取 + 说话人识别 + 双语字幕 | 直播回放、访谈 |
| **Clip2Post** | WtecHtec/Clip2Post | — | 视频转文章 + 文字转视频 + TTS + 动态排版 | 视频→图文二创 / 纯文字成片 |
| **autocut** | mli/autocut | 7.6k | 通过字幕剪视频 | 精剪备选 |
| **opc-cli 小天版** | 小天 fotos 整合 | — | 剪口播+字幕+TTS 一条龙 | 参考其工作流 |

## 目录结构（规划）

```
skills/video-edit-cli/
├── SKILL.md                         # 本文件
├── scripts/
│   ├── install_all.ps1              # 一键拉取 3 个仓库 + 装依赖
│   ├── wrap_videocut.py             # 统一入口：调 videocut 7 能力
│   ├── wrap_openclip.py             # 高光提取
│   ├── wrap_clip2post.py            # 视频转文章 / 文字转视频
│   └── pipeline_koubo.py            # 「口播成片」完整流水线编排
├── templates/
│   ├── cover_templates/             # 封面模板（Luna 风格）
│   └── subtitle_styles/             # 字幕样式（b站/抖音/小红书）
└── config.yaml                      # API key / 模型 / 路径
```

## 核心流水线：口播成片

```
input:  录屏.mp4  +  选题文案.txt（可选）
   │
   ├─ transcribe  (videocut transcribe)         → .srt 逐词时间戳
   ├─ autocut     (videocut autocut)            → 去废话/填充词/长静音
   ├─ subtitle    (videocut subtitle --burn)    → 烧录中文字幕
   ├─ hook        (videocut hook --count 4)     → 生成 4 条 15 秒钩子
   ├─ cover       (videocut cover)              → 封面图 + 标题卡
   ├─ speed       (videocut speed --rate 1.1)   → 适度提速
   └─ （可选）openclip        → 长视频高光片段
output: 成片.mp4 + 字幕.srt + 4 条短钩子 + 封面.png
```

## 常用命令（Jarvis 调用示例）

### 1. 一键成片

```powershell
python -u D:\FY003\skills\video-edit-cli\scripts\pipeline_koubo.py `
  --input "D:\raw\20260422_koubo.mp4" `
  --output "D:\FY003\output\video\20260422\" `
  --platform "douyin" `
  --style "luna-tech-cool"
```

### 2. 只做字幕 + 烧录

```powershell
videocut subtitle "录屏.mp4" -o output\ --burn --lang zh
```

### 3. 长直播高光提取（>20 分钟视频）

```powershell
uv run python video_orchestrator.py "https://www.bilibili.com/video/BVxxx" `
  --llm-provider glm `
  --user-intent "AI 一人公司、Token 经济、9 部门 Agent"
```

### 4. 视频转文章（小红书图文二创）

```powershell
python cli.py --video "录屏.mp4" --extract-clips --add-text-overlay
# 输出：
#   output/article.html（排版好的图文）
#   output/clips/*.mp4（带动态字幕的短片）
#   output/voiceover.mp3（Edge-TTS 重配音）
```

## 与 Jarvis OS 的集成点

1. **注册为 `content-pipeline` 的新节点**：文字脚本 → 视频成片
2. **Luna-growth 调用**：自动成片后推送到 Feishu/WeChat
3. **Token 审计**：视频剪辑走 `hermione-tech` 的 GPU/算力预算
4. **审批门**：重要发布视频走 `snape-audit` 审核

## TTS 语音合成（Clip2Post 集成）

| 引擎 | 特点 | 成本 | 推荐场景 |
|---|---|---|---|
| Edge-TTS | 微软免费 | 免费 | 日常口播 |
| ChatTTS | 中文自然 | 免费 | 角色化 |
| Kokoro | 多语言 | 免费 | 出海 |
| ElevenLabs | 最真 | 付费 | 爆款出圈 |

## 依赖环境

- Python 3.11+
- Node.js 18+
- FFmpeg (brew install ffmpeg / choco install ffmpeg)
- Whisper / MLX Whisper（Apple Silicon）
- uv 包管理器

## 安装（首次）

```powershell
# 拉取 3 个开源项目
git clone https://github.com/zinan92/videocut.git       D:\FY003\tools\videocut
git clone https://github.com/linzzzzzz/openclip.git     D:\FY003\tools\openclip
git clone https://github.com/WtecHtec/Clip2Post.git     D:\FY003\tools\Clip2Post

# 或一键
powershell D:\FY003\skills\video-edit-cli\scripts\install_all.ps1
```

## 下一步（Roadmap）

- [ ] v0.1：pipeline_koubo.py 跑通一条完整口播视频
- [ ] v0.2：封面模板库（Luna 风格 10 套 + 卡兹克式 AI 预告片）
- [ ] v0.3：接入阿里云 VPS，云端剪辑（云端龙虾）
- [ ] v0.4：Luna 自动发布到抖音/B站/小红书（对接 `skills/browser-automation`）
