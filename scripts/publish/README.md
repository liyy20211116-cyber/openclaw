# 🚀 浏览器接管发布工具链

让 Jarvis 通过 **Chrome 远程调试（CDP）** 直接接管 CEO 已登录的浏览器，无需密码、无需重登、Cookie 留在你自己的电脑里。

---

## 一次性设置（≤ 5 分钟）

### 第 1 步：关闭所有 Chrome 窗口

如果你现在有 Chrome 开着，请**全部关闭**（包括后台进程）。

```powershell
# 可选：强制关闭所有 Chrome 进程
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force
```

### 第 2 步：用调试模式启动 Chrome

```powershell
cd D:\FY003
pwsh -ExecutionPolicy Bypass scripts/publish/start_chrome_debuggable.ps1
```

这会打开一个**干净的新 Chrome 窗口**（使用独立 profile：`D:\FY003\.browser-profiles\chrome-publish\`）。

> ⚠️ 这不会影响你平时用的 Chrome 个人资料。

### 第 3 步：在这个 Chrome 窗口里**扫码登录 4 个平台**

依次打开并扫码登录：

| 平台 | 地址 |
|---|---|
| 小红书创作平台 | https://creator.xiaohongshu.com |
| 抖音创作者中心 | https://creator.douyin.com |
| 公众号后台 | https://mp.weixin.qq.com |
| B 站创作中心 | https://member.bilibili.com/platform/home.html |

登录后**不要关闭标签页**，cookie 已永久保存到 profile 目录。

### 第 4 步：验证连接

```powershell
python scripts/publish/probe_cdp.py
```

看到 4 个平台都 `[✓]` 就成功了。

---

## 日常使用

### 之后每次发布前

只要保持**调试模式的 Chrome 窗口开着**（cookie 持久化，登录态不会丢），或重新跑 `start_chrome_debuggable.ps1`。

### 发布命令

**小红书图文：**

```powershell
python scripts/publish/xhs_publisher.py `
    --title "我给9个AI员工发工资" `
    --content-file output/drafts/2026-04-22/xhs-08-first-income.md `
    --images output/posters/xhs-08-cover.png `
    --tags "AI创业" "一人公司" "副业"
# 默认存草稿。加 --publish 直接发，加 --dry-run 只填表不提交。
```

**抖音视频：**

```powershell
python scripts/publish/douyin_publisher.py `
    --video output/videos/01-token-salary.mp4 `
    --title "我给9个AI员工发工资" `
    --tags "一人公司" "AI创业" "副业"
```

**公众号长文（半自动）：**

```powershell
python scripts/publish/wechat_mp_publisher.py `
    --title "我给9个AI员工发工资：Token工资单首曝光" `
    --md output/publish/wechat-official/2026-04-22-token-salary.md
# 脚本会把 HTML 写入剪贴板 + 打开公众号编辑器；
# CEO 在编辑器正文区 Ctrl+V 粘贴，填封面后点『保存』即可。
```

**B 站长视频：**

```powershell
python scripts/publish/bilibili_uploader.py `
    --video output/videos/bilibili-15min-compilation.mp4 `
    --title "一个人+9个AI员工=一家公司" `
    --desc "4 月 Token 工资单公开" `
    --tags "AI创业" "一人公司" "Claude"
```

---

## 安全三道墙

1. **隔离 profile**：`.browser-profiles/chrome-publish/` 加入 `.gitignore`，不进仓库。
2. **默认草稿模式**：所有发布器默认存草稿，加 `--publish` 才真实发送。
3. **人类节奏模拟**：每步操作随机延时 `0.8-2.4s`，降低风控概率。

**再次强调**：**我从头到尾不会索要、也不会碰你的密码**。接管的是**浏览器里的登录状态**，不是账号。

---

## 故障自检

| 现象 | 排查 |
|---|---|
| `CDP 端口 9222 未就绪` | 没跑 `start_chrome_debuggable.ps1`，或 Chrome 被关了 |
| `端口 9222 已被占用` | 之前的 Chrome 没完全退出，先 `Stop-Process -Force` |
| 小红书「上传图文」找不到 | 平台改版，用 `--dry-run` 看实际页面，再改 selector |
| 发布器卡在「等待上传」 | 网速慢/视频太大，脚本会等 120s，超时后用 `--dry-run` 让 CEO 手动接管 |

---

## 限频提醒

- 小红书新号：前 7 天每天不超过 **2 篇图文**，视频 **1 条**
- 抖音新号：前 7 天每天不超过 **1-2 条视频**，同题材不连发
- 公众号订阅号：每日限 **1 次**群发（平台限制）
- B 站：新号前 3 条投稿慎用标签党标题，被限流半个月很难恢复

**Jarvis COO 会在 `token-economy.json` 里记账每次调用，预警过频。**
