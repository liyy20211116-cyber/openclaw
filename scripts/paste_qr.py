"""把剪贴板里的图片粘贴为收款二维码。

用法：
    python scripts/paste_qr.py wechat     # 保存为 assets/qr/wechat.png
    python scripts/paste_qr.py alipay     # 保存为 assets/qr/alipay.png

CEO 只需在手机或微信里长按收款码 → 复制图片 → PC 粘贴到微信文件助手/QQ → 右键图片「复制」
（或直接在网页/PDF 里截图到剪贴板），然后运行本脚本，就把收款码落地到配置中心。

之后自动触发 payment_activation_check.py + render_payment_block.py，收款通道立刻激活。
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QR_DIR = ROOT / "assets" / "qr"

VALID = {"wechat", "alipay"}


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] not in VALID:
        print("usage: python scripts/paste_qr.py {wechat|alipay}")
        return 2
    channel = sys.argv[1]
    try:
        from PIL import ImageGrab
    except ImportError:
        print("[ERR] Pillow missing. pip install pillow")
        return 2

    img = ImageGrab.grabclipboard()
    if img is None:
        print("[ERR] 剪贴板里没有图片。请先复制/截图收款二维码后再运行。")
        return 1

    if isinstance(img, list):
        first = Path(img[0])
        if first.exists():
            from PIL import Image
            img = Image.open(first)
        else:
            print(f"[ERR] 剪贴板指向的文件不存在: {first}")
            return 1

    QR_DIR.mkdir(parents=True, exist_ok=True)
    out = QR_DIR / f"{channel}.png"
    img.save(out, "PNG")
    print(f"[OK] saved {channel} qr to {out} ({out.stat().st_size // 1024} KB)")

    subprocess.run([sys.executable, "scripts/payment_activation_check.py"], check=False, cwd=str(ROOT))
    subprocess.run([sys.executable, "scripts/render_payment_block.py"], check=False, cwd=str(ROOT))
    print("[OK] 收款通道已激活，付款区块已重新渲染")
    return 0


if __name__ == "__main__":
    sys.exit(main())
