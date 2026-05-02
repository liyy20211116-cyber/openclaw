"""生成当月 Token 工资单海报并推送到飞书群机器人（图片消息）。

补齐 CAPABILITY-GAP 报告中「工资单海报飞书自动推送」能力：不依赖外部
`skills.feishu-messaging`，仅用 `config/integrations.json` 的 app 凭证 +
群机器人 webhook。

前置条件（在 integrations.json 中）：
  - feishu.enabled = true
  - feishu.app_id / feishu.app_secret（用于上传图片获取 image_key）
  - feishu.bot_webhook_url（群自定义机器人 webhook）

可选加签：在配置中增加 feishu.bot_sign_secret，或在环境变量 FEISHU_BOT_SIGN_SECRET。

用法：
  python scripts/push_salary_poster_feishu.py
  python scripts/push_salary_poster_feishu.py --month 2026-04
  python scripts/push_salary_poster_feishu.py --dry-run   # 只生成海报并打印将发送的摘要
  python scripts/push_salary_poster_feishu.py --image path/to.png  # 跳过生成，只推送已有图
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import hmac
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:
    requests = None

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_ROOT / "config" / "integrations.json"
POSTER_DIR = PROJECT_ROOT / "output" / "posters"
GEN_SCRIPT = PROJECT_ROOT / "scripts" / "generate_salary_poster.py"


def _load_integrations() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {}
    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _tenant_token(app_id: str, app_secret: str) -> str:
    if requests is None:
        raise RuntimeError("需要 requests：pip install requests")
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    r = requests.post(url, json={"app_id": app_id, "app_secret": app_secret}, timeout=15)
    r.raise_for_status()
    data = r.json()
    if data.get("code") != 0:
        raise RuntimeError(f"获取 tenant_access_token 失败: {data}")
    token = data.get("tenant_access_token")
    if not token:
        raise RuntimeError(f"响应缺少 tenant_access_token: {data}")
    return str(token)


def _upload_image(token: str, png_path: Path) -> str:
    if requests is None:
        raise RuntimeError("需要 requests：pip install requests")
    url = "https://open.feishu.cn/open-apis/im/v1/images"
    headers = {"Authorization": f"Bearer {token}"}
    with png_path.open("rb") as f:
        files = {"image": (png_path.name, f, "image/png")}
        data = {"image_type": "message"}
        r = requests.post(url, headers=headers, files=files, data=data, timeout=60)
    r.raise_for_status()
    body = r.json()
    if body.get("code") != 0:
        raise RuntimeError(f"上传图片失败: {body}")
    key = (body.get("data") or {}).get("image_key")
    if not key:
        raise RuntimeError(f"上传响应缺少 image_key: {body}")
    return str(key)


def _webhook_sign(secret: str) -> tuple[str, str]:
    ts = str(int(time.time()))
    string_to_sign = f"{ts}\n{secret}"
    mac = hmac.new(secret.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha256).digest()
    sign = base64.b64encode(mac).decode("utf-8")
    return ts, sign


def _send_webhook(
    webhook_url: str,
    image_key: str,
    *,
    sign_secret: str | None,
) -> None:
    if requests is None:
        raise RuntimeError("需要 requests：pip install requests")
    payload: dict[str, Any] = {
        "msg_type": "image",
        "content": {"image_key": image_key},
    }
    if sign_secret:
        ts, sign = _webhook_sign(sign_secret)
        payload["timestamp"] = ts
        payload["sign"] = sign
    r = requests.post(webhook_url, json=payload, timeout=30)
    r.raise_for_status()
    try:
        body = r.json()
    except Exception:
        return
    if not isinstance(body, dict):
        return
    if body.get("code") == 0:
        return
    if body.get("StatusCode") == 0:
        return
    if body.get("code") not in (None, 0) or body.get("StatusCode") not in (None, 0):
        raise RuntimeError(f"webhook 返回异常: {body}")


def _send_text_fallback(webhook_url: str, text: str, *, sign_secret: str | None) -> None:
    if requests is None:
        raise RuntimeError("需要 requests：pip install requests")
    payload: dict[str, Any] = {"msg_type": "text", "content": {"text": text}}
    if sign_secret:
        ts, sign = _webhook_sign(sign_secret)
        payload["timestamp"] = ts
        payload["sign"] = sign
    r = requests.post(webhook_url, json=payload, timeout=30)
    r.raise_for_status()


def _run_generate(month: str) -> None:
    cmd = [sys.executable, str(GEN_SCRIPT), "--month", month]
    p = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
    if p.returncode != 0:
        raise RuntimeError(f"生成海报失败，退出码 {p.returncode}")


def main() -> int:
    ap = argparse.ArgumentParser(description="工资单海报生成并推送飞书")
    ap.add_argument("--month", default=dt.date.today().strftime("%Y-%m"))
    ap.add_argument("--image", default=None, help="使用已有 PNG，跳过生成")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    month = args.month
    png = Path(args.image) if args.image else POSTER_DIR / f"salary_poster_{month}.png"

    if not args.image:
        print(f"[i] 生成海报: {month}")
        _run_generate(month)

    if not png.is_file():
        print(f"[!] 找不到海报文件: {png}", file=sys.stderr)
        return 2

    cfg = _load_integrations()
    fe = cfg.get("feishu") or {}
    enabled = bool(fe.get("enabled"))
    app_id = str(fe.get("app_id") or "").strip()
    app_secret = str(fe.get("app_secret") or "").strip()
    webhook = str(fe.get("bot_webhook_url") or "").strip()
    sign_secret = (fe.get("bot_sign_secret") or "").strip() or None

    if args.dry_run:
        print(f"[dry-run] 海报: {png.resolve()}")
        print(f"[dry-run] feishu.enabled={enabled} webhook 已配置={bool(webhook and not webhook.startswith('TODO'))}")
        print("[dry-run] 未调用飞书上传 / webhook")
        return 0

    if not enabled:
        print("[!] config/integrations.json 中 feishu.enabled 为 false，跳过推送", file=sys.stderr)
        return 0

    if "TODO" in webhook or not webhook.startswith("http"):
        print("[!] feishu.bot_webhook_url 未配置，跳过推送", file=sys.stderr)
        return 0

    if "TODO" in app_id or "TODO" in app_secret or not app_id or not app_secret:
        print("[!] feishu.app_id / app_secret 未配置，无法上传图片；发送文字摘要到 webhook", file=sys.stderr)
        try:
            summary = f"{month} Token 工资单海报已生成（未配置 app 凭证无法发图）\n本地路径: {png.resolve()}"
            _send_text_fallback(webhook, summary, sign_secret=sign_secret)
            print("[OK] 已发送文字说明到飞书")
        except Exception as e:
            print(f"[!] 文字推送失败: {e}", file=sys.stderr)
            return 3
        return 0

    if requests is None:
        print("[!] 未安装 requests，无法推送。pip install requests", file=sys.stderr)
        return 4

    try:
        token = _tenant_token(app_id, app_secret)
        image_key = _upload_image(token, png)
        _send_webhook(webhook, image_key, sign_secret=sign_secret)
        print(f"[OK] 已推送图片到飞书: {png.name} (image_key 已使用)")
        return 0
    except Exception as e:
        print(f"[!] 图片推送失败: {e}", file=sys.stderr)
        try:
            summary = f"{month} 工资单海报推送图片失败: {e}\n本地文件: {png.resolve()}"
            _send_text_fallback(webhook, summary, sign_secret=sign_secret)
            print("[i] 已尝试发送文字兜底到飞书")
        except Exception as e2:
            print(f"[!] 文字兜底也失败: {e2}", file=sys.stderr)
        return 5


if __name__ == "__main__":
    raise SystemExit(main())
