"""新客户 Onboarding 一键自动化脚本（对应 docs/sales/onboarding-sop.md）。

用法：
    python scripts/onboarding_new_customer.py --buyer "张三" --plan pro \
        --sku pro-yearly --email zhang@example.com --wechat zhang_wx --tenant acme

完成的事：
    1. 生成该客户的租户 ID（默认 = 时间戳哈希）
    2. 调 scripts/license/issue.py 发放授权码
    3. 渲染 templates/license-email.md 填充变量 → output/onboarding/<tenant>.md
    4. 记录到 output/onboarding/ledger.jsonl
    5. 打印客服话术（直接复制发微信）

设计：人类只需要一条命令，其余全部由 AI 员工流水线完成。
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = PROJECT_ROOT / "templates" / "license-email.md"
OUT_DIR = PROJECT_ROOT / "output" / "onboarding"
LEDGER = OUT_DIR / "ledger.jsonl"
LICENSES_REGISTRY = PROJECT_ROOT / "output" / "licenses" / "registry.jsonl"

PLAN_META = {
    "starter": {"name_cn": "启航版", "pack_count": 1, "valid_days": 36500},
    "pro": {"name_cn": "标准版", "pack_count": 3, "valid_days": 365},
    "enterprise": {"name_cn": "企业版", "pack_count": "定制", "valid_days": 36500},
}


def gen_tenant_id(buyer: str, email: str) -> str:
    seed = f"{buyer}|{email}|{dt.datetime.utcnow().isoformat()}"
    h = hashlib.md5(seed.encode()).hexdigest()[:8]
    return f"cust-{dt.datetime.utcnow():%Y%m}-{h}"


def issue_via_cli(tenant: str, plan: str, sku: str, buyer: str, valid_days: int) -> str:
    """调用 issue.py CLI，从 registry.jsonl 取最新那条。"""
    cmd = [
        sys.executable,
        "scripts/license/issue.py",
        "--tenant", tenant,
        "--plan", plan,
        "--sku", sku,
        "--buyer", buyer,
        "--valid-days", str(valid_days),
    ]
    res = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True, encoding="utf-8", errors="replace")
    if res.returncode != 0:
        raise RuntimeError(f"issue.py failed: {res.stderr}")
    with LICENSES_REGISTRY.open(encoding="utf-8") as f:
        last = None
        for line in f:
            last = line
        if not last:
            raise RuntimeError("registry empty after issue")
        return json.loads(last)["code"]


def render_template(vars: dict) -> str:
    if not TEMPLATE.exists():
        return "（template missing）"
    text = TEMPLATE.read_text(encoding="utf-8")
    for k, v in vars.items():
        text = text.replace(f"{{{{{k}}}}}", str(v))
    return text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--buyer", required=True)
    ap.add_argument("--plan", choices=list(PLAN_META), default="starter")
    ap.add_argument("--sku", required=True)
    ap.add_argument("--email", default="")
    ap.add_argument("--wechat", default="")
    ap.add_argument("--amount", type=int, default=0, help="实际付款金额")
    ap.add_argument("--tenant", default="", help="不填则自动生成")
    ap.add_argument("--order-no", default="")
    args = ap.parse_args()

    tenant = args.tenant or gen_tenant_id(args.buyer, args.email or args.wechat or "anon")
    meta = PLAN_META[args.plan]
    order_no = args.order_no or f"JO-{dt.datetime.utcnow():%Y%m%d}-{tenant[-4:]}"

    code = issue_via_cli(tenant, args.plan, args.sku, args.buyer, meta["valid_days"])

    expires_at = "永久" if meta["valid_days"] > 3650 else (dt.datetime.utcnow() + dt.timedelta(days=meta["valid_days"])).strftime("%Y-%m-%d")
    vars_ = {
        "buyer_name": args.buyer,
        "amount": args.amount,
        "sku_name": meta["name_cn"],
        "license_code": code,
        "plan": meta["name_cn"],
        "pack_count": meta["pack_count"],
        "checklist_link": "https://jarvis-os.com/download/checklist.pdf",
        "prompt_pack_link": "https://jarvis-os.com/download/prompt-pack.zip",
        "video_link": "https://space.bilibili.com/3706974745135246",
        "group_qr_link": "（12 小时内发放专属群）",
        "order_no": order_no,
        "pay_time": dt.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "expires_at": expires_at,
        "tenant_id": tenant,
        "desktop_dl": "https://jarvis-os.com/download/desktop",
        "docs_url": "https://jarvis-os.com/docs",
        "pack_url": "https://jarvis-os.com/packs",
        "invoice_type": "增值税电子普通发票",
        "invoice_title": "（待买家提供）",
        "invoice_tax_id": "（待买家提供）",
        "email": args.email or "（未提供）",
        "slack_link": "（企业版 1v1 群）",
        "signature": "— 李原野 / 野子哥",
    }

    rendered = render_template(vars_)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{tenant}.md"
    out_path.write_text(rendered, encoding="utf-8")

    with LEDGER.open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "tenant_id": tenant,
            "buyer": args.buyer,
            "plan": args.plan,
            "sku": args.sku,
            "amount": args.amount,
            "email": args.email,
            "wechat": args.wechat,
            "license_code": code,
            "order_no": order_no,
            "created_at": dt.datetime.utcnow().isoformat() + "Z",
        }, ensure_ascii=False) + "\n")

    print("=" * 80)
    print(f"[OK] 新客户 Onboarding 完成")
    print(f"租户 ID    : {tenant}")
    print(f"订单号     : {order_no}")
    print(f"授权码     : {code}")
    print(f"发放文档   : {out_path}")
    print(f"账簿追加   : {LEDGER}")
    print("=" * 80)
    print("把 output/onboarding/ 下这份 md 里的【模板 A 微信回执】复制发给客户即可。")
    print("=" * 80)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
