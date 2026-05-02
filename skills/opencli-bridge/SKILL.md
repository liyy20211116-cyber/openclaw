---
name: opencli-bridge
description: "对接 jackwener/opencli（91 个网站适配器）与 nashsu/opencli-rs（Rust 版 55 站点），让 Jarvis 的 Agent 能用一行命令抓取 B站/抖音/小红书/知乎/Twitter/HN 等平台的数据；替代 web-search 的升级版。"
metadata: { "openclaw": { "emoji": "🦀", "os": ["win32"] } }
---

# OpenCLI Bridge — 79+ 平台数据取数桥

对标 jackwener/OpenCLI（15.6k⭐，杭州 Apache PMC 成员 jackwener 出品）+ nashsu/opencli-rs（1.5k⭐，Rust 重写版，12× 更快）。

## 为什么需要

- Jarvis 现在的 `web-search` 只能做通用搜索，**拿不到结构化数据**
- 竞品分析、热点监控、对标账号拆解全要手工复制粘贴
- OpenCLI 用 **Chrome 扩展桥** 复用现有登录态，**零风控 / 零凭证存储**
- 一行 `opencli bilibili hot --limit 10 -f json` 解决所有问题

## 覆盖平台（91 个）

| 类别 | 平台 |
|---|---|
| 视频 | **Bilibili、YouTube、TikTok、抖音** |
| 社交 | **Twitter/X、Reddit、小红书、微博、知乎、Instagram、Bluesky、Facebook** |
| 技术 | HackerNews、V2EX、Linux.do、Stack Overflow、**GitHub** |
| 搜索 | Bing、Google、DuckDuckGo |
| AI 桌面端 | **Cursor、Codex、ChatGPT、Gemini、Grok、Doubao、NotebookLM** |
| 金融 | **雪球**、Yahoo Finance、Bloomberg、新浪财经 |
| 新闻 | **Hacker News、Product Hunt**、Medium、Substack |
| 招聘 | **BOSS 直聘**、LinkedIn |
| 其他 | Wikipedia、arXiv |

## 与现有能力对比

| 能力 | 现有 `skills/web-search` | OpenCLI Bridge |
|---|---|---|
| 返回结构化数据 | ❌ 纯文本 | ✅ JSON/CSV/Markdown |
| 复用登录态 | ❌ | ✅ Chrome 扩展 |
| 风控风险 | 高 | **极低** |
| 抓取深度 | 摘要 | 完整评论/点赞/转发 |
| 调用成本 | LLM token | 0 额外 LLM |
| 更新频率 | 依赖模型 | 实时 |

## 目录结构（规划）

```
skills/opencli-bridge/
├── SKILL.md                     # 本文件
├── scripts/
│   ├── install.ps1              # npm install -g @jackwener/opencli + 装扩展
│   ├── bench.py                 # 三大平台抓取基准测试
│   ├── competitor_monitor.py    # 对标账号每日追踪
│   └── hot_aggregator.py        # 6 平台热点聚合 → 生成选题日报
├── adapters/                    # 自定义适配器（公司内部系统）
└── output/
    ├── daily_hot/               # 每日热点快照
    └── competitor/              # 竞品数据时序
```

## 核心用法

### 1. 基础数据抓取

```powershell
# 抖音热榜
opencli douyin trending --limit 20 -f json > output\daily_hot\douyin_20260422.json

# 小红书搜索
opencli xiaohongshu search "一人公司" --limit 50 -f json

# B站热门
opencli bilibili hot --limit 30 -f csv

# 知乎热榜
opencli zhihu hot -f json

# GitHub 搜"opc"相关
opencli github search "opc OR one-person-company" --sort stars --limit 20

# 雪球个股
opencli xueqiu stock SH000300 -f json
```

### 2. 内容下载

```powershell
# 小红书笔记下载
opencli xiaohongshu download --note-id abc123

# B站视频下载（yt-dlp）
opencli bilibili download BV1xxx --quality 1080p

# Twitter 用户最近 N 条
opencli twitter download --username elonmusk --limit 20
```

### 3. 控制桌面 AI（CLI All Electron）

```powershell
opencli cursor command "重构这段代码"
opencli chatgpt ask "解释量子计算"
opencli notion query "一人公司"
```

### 4. 竞品监控（日常运营）

```powershell
python -u D:\FY003\skills\opencli-bridge\scripts\competitor_monitor.py `
  --accounts "阿彦能行,数字生命卡兹克,拉斐尔2077,阿森编程日记" `
  --platforms "douyin,xiaohongshu,bilibili" `
  --output D:\FY003\output\competitor\20260422.json
```

输出：
- 每个账号近 7 天新增作品
- 播放量/点赞/评论增量
- 新选题关键词聚类
- 写入 `luna-growth` 的 learnings.md

## 与 Jarvis OS 的集成点

1. **Luna-growth**：每日早 9 点跑 `hot_aggregator.py`，产出选题池
2. **Fred-sales**：抓 BOSS 直聘/LinkedIn 的目标客户 JD
3. **Mcgonagall-product**：抓 Product Hunt + HN 做产品调研
4. **Percy-finance**：抓雪球 + Bloomberg 做营收对标
5. **Haimian（海绵）**：所有调研任务的一线数据来源

## 安装（首次）

```powershell
# 方案 A：Node 版（原版，生态最全）
npm install -g @jackwener/opencli

# 方案 B：Rust 版（12× 更快，单文件）
curl -fsSL https://raw.githubusercontent.com/nashsu/opencli-rs/main/scripts/install.sh | sh

# 装 Chrome 扩展
git clone https://github.com/jackwener/OpenCLI.git D:\FY003\tools\OpenCLI
# 打开 chrome://extensions → 加载 D:\FY003\tools\OpenCLI\extension\

# 验证
opencli doctor

# 顺带装 Qiaomu 社区 Skills（775⭐，向阳乔木）
npx skills add jackwener/opencli
```

## 下一步（Roadmap）

- [ ] v0.1：hot_aggregator.py 跑通 6 平台聚合
- [ ] v0.2：competitor_monitor.py 接入 Luna 的选题库
- [ ] v0.3：自定义 adapter—把本地 Jarvis API 也变成 CLI
- [ ] v0.4：迁移到 opencli-rs，降低 10× 内存
