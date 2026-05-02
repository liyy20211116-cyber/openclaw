# 第三方集成配置

> **重要**：本目录将在 M2 阶段改为加密存储（.enc 文件 + Windows DPAPI / 云 KMS）。
> 当前 M1 阶段使用明文 JSON 占位，**请勿将真实 Secret 提交到 git**。

## 需要 CEO 提供的平台账号（按紧急程度）

### 🔥 Day 2（内容发布前必须）

| 平台 | 需要提供 | 如何提供 |
|---|---|---|
| 抖音 | 账号名（建议「Jarvis一人公司OS」）+ 登录手机 | 填 `integrations/douyin.json` |
| 小红书 | 账号名 + 登录手机 | 填 `integrations/xiaohongshu.json` |
| B站 | UID + 登录邮箱 | 填 `integrations/bilibili.json` |
| 公众号 | 公众号名 + AppID + AppSecret（可选）| 填 `integrations/wechat-official.json` |

### 🔥 Day 3（收款前必须）

| 支付 | 需要提供 |
|---|---|
| 支付宝个人 | 收款码图片（上传到 `assets/qr/alipay.png`）|
| 微信个人 | 收款码图片（上传到 `assets/qr/wechat.png`）|
| 对公账户（可选）| 公司名 / 银行 / 账号 / 税号，填 `commerce.json.bank_account` |
| 电子发票 | 诺诺/开票魔方 API Key（如需开票）|

### 🔥 Day 5（录制开场白视频前）

| 信息 | 说明 |
|---|---|
| CEO 姓名/花名 | 用于 30 秒开场白 |
| 一句话自我介绍 | 30 字以内 |
| 是否出镜 | 不出镜可全走 TTS + 动态字幕 |
| Logo | 如无，我可以用 image-gen 生成 |

### Day 7+（可选，产品化才需要）

- GitHub 账号（发布 releases / 开源社区版本）
- 域名（Landing Page 需要，比如 jarvis-os.com）
- ICP 备案信息（正式商用）
- 飞书 App（已有）的客户端凭证
- 阿里云/腾讯云账号（Q2 SaaS 云端部署）

## 填写模板

每个 json 文件格式大致如下（以抖音为例）：

```json
{
  "enabled": true,
  "account_name": "Jarvis一人公司OS",
  "login_method": "phone",
  "login_id": "138****8888",
  "cookies_file": "secrets/douyin_cookies.json",
  "post_schedule": "daily_19:00",
  "notes": "首发账号，主推一人公司议题"
}
```

## 安全规范

- ❌ 禁止把 AppSecret / Cookie / Token 直接贴到这些 json 里
- ✅ 敏感字段走环境变量或 secrets/ 下的加密文件
- ✅ 所有 integrations/*.json 在 `.gitignore` 中默认忽略（M2 将强制）
- ✅ 首次填入时由 CEO 本人完成，Jarvis 只做读和调用
