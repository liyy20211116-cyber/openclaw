"""支付激活校验脚本。

检查 assets/qr/ 下的收款二维码是否已上传；
如果微信收款码存在，则把 config 状态更新为「已激活-微信通道」，
输出一份 activation 报告到 output/ops/payment-status.md。

供 Jarvis-CFO(珀西) 定时调用，也可 CEO 手工 `python scripts/payment_activation_check.py`。
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TENANT = ROOT / "config" / "tenant" / "default"
COMMERCE_PATH = TENANT / "commerce.json"
QR_DIR = ROOT / "assets" / "qr"
REPORT_DIR = ROOT / "output" / "ops"


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    if not COMMERCE_PATH.exists():
        print("[ERR] commerce.json not found", file=sys.stderr)
        return 2
    commerce = _load_json(COMMERCE_PATH)

    wechat_rel = commerce.get("personal_qr", {}).get("wechat_qr_path", "")
    alipay_rel = commerce.get("personal_qr", {}).get("alipay_qr_path", "")

    wechat_ok = bool(wechat_rel) and (ROOT / wechat_rel).exists()
    alipay_ok = bool(alipay_rel) and (ROOT / alipay_rel).exists()

    enabled = commerce.get("enabled", False)
    channels = []
    if wechat_ok:
        channels.append("wechat")
    if alipay_ok:
        channels.append("alipay")

    status = "active" if (enabled and channels) else "pending"

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report = REPORT_DIR / "payment-status.md"
    lines = [
        "# 支付通道激活状态",
        "",
        f"- 生成时间：{datetime.now():%Y-%m-%d %H:%M:%S}",
        f"- 整体状态：**{status.upper()}**",
        f"- 已开通渠道：{', '.join(channels) if channels else '（无，等待二维码上传）'}",
        f"- 收款人：{commerce.get('personal_qr', {}).get('receiver_name', '')}",
        "",
        "| 渠道 | 二维码路径 | 已就绪 |",
        "|------|-----------|--------|",
        f"| 微信 | `{wechat_rel or '（未配置）'}` | {'✅' if wechat_ok else '⬜'} |",
        f"| 支付宝 | `{alipay_rel or '（未配置）'}` | {'✅' if alipay_ok else '⬜'} |",
        "",
        "## 下一步",
    ]
    if not wechat_ok:
        lines.append("- CEO 把微信收款码另存到 `assets/qr/wechat.png`（从微信 App → 我 → 服务 → 收付款 → 二维码收款 → 保存图片）。")
    if not alipay_ok:
        lines.append("- CEO 把支付宝收款码另存到 `assets/qr/alipay.png`（支付宝 App → 收钱 → 保存到相册）。")
    if channels:
        lines.append(f"- 已有 {len(channels)} 个渠道可用，建议把 Landing Page 付款区块发布。")
    lines.append("")
    report.write_text("\n".join(lines), encoding="utf-8")

    try:
        print(f"[OK] status={status} channels={channels} report={report}")
    except Exception:
        print(f"[OK] status={status} channels={len(channels)}")
    return 0 if status == "active" else 1


if __name__ == "__main__":
    sys.exit(main())
