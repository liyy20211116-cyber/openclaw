"""渲染付款区块 HTML 片段。

读取 commerce.json / branding.json，输出一个标准的付款说明 HTML
到 output/landing/payment-block.html，可被 pricing.html / thank-you.html 内联或 iframe 引入。

也输出一份 Markdown 版本用于公众号文章 / 私信话术。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TENANT = ROOT / "config" / "tenant" / "default"
OUT_DIR = ROOT / "output" / "landing"

HTML_TEMPLATE = """<section class="jarvis-payment-block" style="max-width:720px;margin:48px auto;padding:32px;background:#121622;color:#F0F4FF;border-radius:18px;border:1px solid rgba(247,195,37,.25);font-family:'PingFang SC','Microsoft YaHei',sans-serif;">
  <h2 style="color:#F7C325;margin:0 0 16px;font-size:26px;">🧾 购买方式</h2>
  <p style="opacity:.8;line-height:1.7;margin:0 0 24px;">当前支持 <strong>{channels_desc}</strong>。下单后请把付款截图 + 你的「微信号 / 邮箱 / 版本」发给客服，<strong>12 小时内</strong>发放授权码。</p>

  <div style="display:flex;gap:24px;flex-wrap:wrap;justify-content:center;">
    {qr_blocks}
  </div>

  <div style="margin-top:32px;padding:20px;background:rgba(247,195,37,.08);border-radius:12px;">
    <h3 style="margin:0 0 10px;color:#F7C325;">⚡ 联系方式</h3>
    <ul style="margin:0;padding-left:20px;line-height:2;">
      <li>客服微信：<code>{wechat_id}</code></li>
      <li>收款人：<strong>{receiver}</strong></li>
      <li>售后支持：{support_note}</li>
    </ul>
  </div>

  <p style="opacity:.6;font-size:13px;margin-top:24px;text-align:center;">© 2026 Jarvis One Company OS · 7 天无理由退款 · 永久授权</p>
</section>
"""

QR_BLOCK_TEMPLATE = """<div style="flex:1;min-width:240px;text-align:center;padding:24px;background:rgba(255,255,255,.04);border-radius:14px;">
      <div style="font-size:18px;color:#F7C325;margin-bottom:12px;">{channel_icon} {channel_name}</div>
      <img src="{qr_path}" alt="{channel_name}收款码" style="width:200px;height:200px;border-radius:8px;background:#fff;padding:8px;" />
      <div style="margin-top:10px;opacity:.75;font-size:14px;">收款人：{receiver}</div>
    </div>"""


def main() -> int:
    commerce = json.loads((TENANT / "commerce.json").read_text(encoding="utf-8"))
    branding = json.loads((TENANT / "branding.json").read_text(encoding="utf-8"))
    tenant = json.loads((TENANT / "tenant.json").read_text(encoding="utf-8"))

    wechat_rel = commerce.get("personal_qr", {}).get("wechat_qr_path", "")
    alipay_rel = commerce.get("personal_qr", {}).get("alipay_qr_path", "")
    receiver = commerce.get("personal_qr", {}).get("receiver_name", "野子哥")
    support = branding.get("payment", {}).get("support_note", "")
    wechat_id = tenant.get("owner", {}).get("wechat_id", "")

    qr_blocks = []
    channels_desc_parts = []
    if wechat_rel and (ROOT / wechat_rel).exists():
        qr_blocks.append(
            QR_BLOCK_TEMPLATE.format(
                channel_icon="💚",
                channel_name="微信支付",
                qr_path=f"/{wechat_rel}",
                receiver=receiver,
            )
        )
        channels_desc_parts.append("微信支付")
    if alipay_rel and (ROOT / alipay_rel).exists():
        qr_blocks.append(
            QR_BLOCK_TEMPLATE.format(
                channel_icon="💙",
                channel_name="支付宝",
                qr_path=f"/{alipay_rel}",
                receiver=receiver,
            )
        )
        channels_desc_parts.append("支付宝")

    if not qr_blocks:
        qr_blocks.append(
            """<div style=\"padding:24px;text-align:center;opacity:.7;\">
      <div style=\"font-size:16px;\">⏳ 收款通道配置中</div>
      <div style=\"margin-top:8px;font-size:13px;\">请直接加微信 <code>go19237140413</code> 下单，我们会在 12 小时内发送付款方式。</div>
    </div>"""
        )
        channels_desc_parts.append("微信手工下单")

    html = HTML_TEMPLATE.format(
        channels_desc=" / ".join(channels_desc_parts),
        qr_blocks="\n    ".join(qr_blocks),
        wechat_id=wechat_id,
        receiver=receiver,
        support_note=support,
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    html_path = OUT_DIR / "payment-block.html"
    html_path.write_text(html, encoding="utf-8")

    md_lines = [
        "## 购买方式",
        "",
        f"当前支持：{' / '.join(channels_desc_parts)}。",
        "",
    ]
    if wechat_rel and (ROOT / wechat_rel).exists():
        md_lines += [
            "### 微信支付",
            "",
            f"![微信收款码]({wechat_rel})",
            f"收款人：{receiver}",
            "",
        ]
    if alipay_rel and (ROOT / alipay_rel).exists():
        md_lines += [
            "### 支付宝",
            "",
            f"![支付宝收款码]({alipay_rel})",
            f"收款人：{receiver}",
            "",
        ]
    md_lines += [
        "### 付款后",
        "",
        f"把付款截图 + 版本（启航/标准/企业）+ 你的微信号 发给客服：",
        f"- 微信：`{wechat_id}`",
        f"- {support}",
        "",
        "12 小时内发放授权码，7 天无理由退款。",
    ]
    md_path = OUT_DIR / "payment-block.md"
    md_path.write_text("\n".join(md_lines), encoding="utf-8")

    try:
        print(f"[OK] payment block generated: {html_path} / {md_path}")
    except Exception:
        print("[OK] payment block generated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
