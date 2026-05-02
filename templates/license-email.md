# 授权码发放邮件/微信模板

> Fred 销售经理 + Dobby 客户成功 合用。付款确认后 12 小时内发送。

## 模板 A · 微信回执（首选）

```
{{buyer_name}} 你好！✅

已收到你 {{amount}} 元的付款（{{sku_name}}）。感谢支持 Jarvis One Company OS！

🔑 你的专属授权码：
{{license_code}}

📦 下载地址：
https://jarvis-os.com/download/{{plan}}
（含桌面端 + {{pack_count}} 个行业 Pack + 9 个 AI 员工）

🎁 附赠资料：
1. 《AI 一人公司自检清单》：{{checklist_link}}
2. 9 个 AI 员工提示词包：{{prompt_pack_link}}
3. 《Token 工资制 · 2 小时速学》：{{video_link}}

📱 激活步骤（3 分钟）：
  1) 下载并安装
  2) 首次启动时在「帮助 → 输入授权码」粘贴上方授权码
  3) 确认后就能看到 9 个 AI 员工上线

👥 专属用户群：
{{group_qr_link}}
（野子哥每周三晚 8 点直播答疑）

🛡️ 服务承诺：
- 7 天无理由退款（到账后原路返还）
- 一年内免费升级到新版本（标准版/企业版）
- 24 小时内响应技术问题

有任何问题随时找我（野子哥）微信 go19237140413。

祝你的第一家 AI 一人公司早日盈利！🚀
```

## 模板 B · 邮件发送（用于企业买家）

主题：【Jarvis OS 授权码已发放】{{order_no}} · {{sku_name}}

正文：

```
{{buyer_name}} 先生 / 女士：

您好！您于 {{pay_time}} 购买的 Jarvis One Company OS {{sku_name}}
付款（¥{{amount}}，订单号 {{order_no}}）已确认收到。

专属授权码：
  {{license_code}}

有效期：{{expires_at}}
许可版本：{{plan}}
绑定租户 ID：{{tenant_id}}

下载 + 部署文档：
  - 桌面端：{{desktop_dl}}
  - 文档：{{docs_url}}
  - API Pack 下载：{{pack_url}}

发票：我们将在 3 个工作日内开具电子发票（{{invoice_type}}），
抬头：{{invoice_title}}，税号：{{invoice_tax_id}}。
开票完成后通过邮件发送至：{{email}}

售后咨询：
  - 1v1 技术支持：{{slack_link}}
  - 工作时间：周一至周五 9:00-18:00
  - 客服微信：go19237140413（野子哥）

感谢您对国产 AI 一人公司产品的支持。
此致
李原野 · Jarvis One Company OS 创始人
{{signature}}
```

## 变量说明

| 变量 | 来源 | 示例 |
|------|------|------|
| {{license_code}} | `scripts/license/issue.py` | `JARVIS-PRO-XXXX-XXXX-XXXX` |
| {{plan}} | SKU | `starter` / `pro` / `enterprise` |
| {{sku_name}} | `commerce.json` | `启航版 · 买断` |
| {{amount}} | SKU | `999` |
| {{tenant_id}} | 新建租户 ID | `cust-202604-001` |
| {{expires_at}} | 授权期限 | `2027-04-22` / `永久` |
| {{order_no}} | 自动生成 | `JO-20260422-001` |

## 发送自动化

- **微信**：skill `wechat-bot` 调用 `wx_send.py`，附件为授权码 + 资料包 zip。
- **邮件**：skill `email-send`（待建）调用 `curl` + SMTP；或手工从 Outlook 发送。
