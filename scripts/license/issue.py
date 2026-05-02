"""Jarvis OS 许可证发放器 v0.1（WP3）。

用途：为每笔订单生成一个可被 Jarvis 桌面端识别和验证的许可证码。

v0.1 设计：
- 无需服务器（桌面端可离线校验）
- 签名用 HMAC-SHA256（本地 master key）
- 格式：JSV1-<base64(payload)>-<base64(sig)>
- payload 含：tenant_id / plan / expires_at / issued_at / sku / buyer

用法：
    # 生成许可证
    python scripts/license/issue.py --tenant acme --plan pro --sku pro-yearly \
        --buyer "张三" --valid-days 365

    # 批量生成（从 CSV）
    python scripts/license/issue.py --batch orders.csv

    # 验证一个许可证
    python scripts/license/issue.py --verify "JSV1-..."

    # 查看全部已发放
    python scripts/license/issue.py --list

依赖：
    无（仅使用 Python 标准库）

环境变量：
    JARVIS_LICENSE_KEY  —— 签名 master key（生产环境务必改掉默认值）

输出：
    output/licenses/<tenant>_<timestamp>.json    —— 许可证原文 + 码
    output/licenses/registry.jsonl               —— 发放日志（追加）
"""

from __future__ import annotations

import argparse
import base64
import csv
import datetime as dt
import hashlib
import hmac
import json
import os
import sys
import uuid
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = PROJECT_ROOT / "output" / "licenses"
REGISTRY = OUT_DIR / "registry.jsonl"
MASTER_KEY = os.environ.get("JARVIS_LICENSE_KEY", "jarvis-default-master-key-CHANGE-ME-IN-PROD").encode()


def _b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def issue_license(tenant_id: str, plan: str, sku: str, buyer: str, valid_days: int, extra: dict | None = None) -> tuple[str, dict]:
    now = dt.datetime.utcnow()
    payload = {
        "v": 1,
        "tenant_id": tenant_id,
        "plan": plan,
        "sku": sku,
        "buyer": buyer,
        "issued_at": now.isoformat() + "Z",
        "expires_at": (now + dt.timedelta(days=valid_days)).isoformat() + "Z",
        "license_id": str(uuid.uuid4()),
    }
    if extra:
        payload.update(extra)

    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(MASTER_KEY, raw, hashlib.sha256).digest()
    code = f"JSV1-{_b64e(raw)}-{_b64e(sig)}"
    return code, payload


def verify_license(code: str) -> tuple[bool, dict | str]:
    try:
        if not code.startswith("JSV1-"):
            return False, "format: missing JSV1 prefix"
        parts = code.split("-", 2)
        if len(parts) != 3:
            return False, "format: wrong number of segments"
        _, payload_b64, sig_b64 = parts
        raw = _b64d(payload_b64)
        sig = _b64d(sig_b64)
        expected = hmac.new(MASTER_KEY, raw, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected):
            return False, "signature mismatch"
        payload = json.loads(raw.decode("utf-8"))
        expires = dt.datetime.fromisoformat(payload["expires_at"].rstrip("Z"))
        if expires < dt.datetime.utcnow():
            return False, f"expired at {payload['expires_at']}"
        return True, payload
    except Exception as e:
        return False, f"error: {e}"


def save_license(code: str, payload: dict) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    out = OUT_DIR / f"{payload['tenant_id']}_{ts}.json"
    out.write_text(json.dumps({"code": code, "payload": payload}, ensure_ascii=False, indent=2), encoding="utf-8")
    with REGISTRY.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"code": code, **payload}, ensure_ascii=False) + "\n")
    return out


def batch_issue(csv_path: Path, valid_days: int) -> list[dict]:
    results = []
    with csv_path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code, payload = issue_license(
                tenant_id=row.get("tenant_id") or row.get("tenant"),
                plan=row.get("plan", "starter"),
                sku=row.get("sku", ""),
                buyer=row.get("buyer", ""),
                valid_days=int(row.get("valid_days") or valid_days),
            )
            save_license(code, payload)
            results.append({"code": code, "payload": payload})
    return results


def list_licenses(limit: int = 20) -> list[dict]:
    if not REGISTRY.exists():
        return []
    lines = REGISTRY.read_text(encoding="utf-8").strip().splitlines()
    out = []
    for line in lines[-limit:]:
        try:
            out.append(json.loads(line))
        except Exception:
            continue
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Jarvis OS License Issuer v0.1")
    ap.add_argument("--tenant", help="租户 ID（小写、数字、短横线）")
    ap.add_argument("--plan", choices=["starter", "pro", "enterprise"], default="starter")
    ap.add_argument("--sku", default="")
    ap.add_argument("--buyer", default="")
    ap.add_argument("--valid-days", type=int, default=365)
    ap.add_argument("--batch", help="CSV 路径（列：tenant_id,plan,sku,buyer,valid_days）")
    ap.add_argument("--verify", help="验证一个已发放的许可证码")
    ap.add_argument("--list", action="store_true", help="列出最近发放的 20 条")
    args = ap.parse_args()

    if args.verify:
        ok, info = verify_license(args.verify)
        print("VALID:" if ok else "INVALID:", info)
        return 0 if ok else 1

    if args.list:
        for it in list_licenses():
            print(f"{it.get('issued_at','')}  {it.get('tenant_id',''):15s}  {it.get('plan','')}  {it.get('buyer','')}")
        return 0

    if args.batch:
        results = batch_issue(Path(args.batch), args.valid_days)
        print(f"[batch] 共发放 {len(results)} 张许可证")
        return 0

    if not args.tenant:
        ap.print_help()
        return 2

    code, payload = issue_license(args.tenant, args.plan, args.sku, args.buyer, args.valid_days)
    path = save_license(code, payload)
    print("=" * 80)
    print(f"租户  {payload['tenant_id']}")
    print(f"套餐  {payload['plan']}")
    print(f"SKU   {payload['sku']}")
    print(f"买家  {payload['buyer']}")
    print(f"发放  {payload['issued_at']}")
    print(f"到期  {payload['expires_at']}")
    print(f"存档  {path}")
    print("=" * 80)
    print("LICENSE:")
    print(code)
    print("=" * 80)
    print("把上面这行许可证码发给买家（邮件/微信）即可。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
