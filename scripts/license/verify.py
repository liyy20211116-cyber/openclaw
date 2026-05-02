"""Jarvis OS 客户端许可证校验（桌面端调用）。

用法（代码内）：
    from scripts.license.verify import verify_current
    ok, info = verify_current()
    if not ok:
        raise RuntimeError(f"License invalid: {info}")

用法（CLI）：
    python scripts/license/verify.py                # 使用 config/tenant/default/license.txt
    python scripts/license/verify.py --code "JSV1-..."

许可证存放位置：
    1. 环境变量 JARVIS_LICENSE
    2. config/tenant/<tenant_id>/license.txt
    3. config/license.txt（兼容单租户场景）
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# 与 issue.py 共享校验逻辑
sys.path.insert(0, str(Path(__file__).resolve().parent))
from issue import verify_license  # type: ignore  # noqa: E402

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def read_local_license(tenant_id: str = "default") -> str | None:
    # 优先读环境变量
    env_code = os.environ.get("JARVIS_LICENSE")
    if env_code:
        return env_code.strip()
    candidates = [
        PROJECT_ROOT / "config" / "tenant" / tenant_id / "license.txt",
        PROJECT_ROOT / "config" / "license.txt",
    ]
    for p in candidates:
        if p.exists():
            return p.read_text(encoding="utf-8").strip()
    return None


def verify_current(tenant_id: str = "default") -> tuple[bool, dict | str]:
    code = read_local_license(tenant_id)
    if not code:
        return False, "未找到许可证：请设置 JARVIS_LICENSE 环境变量或把 JSV1-... 写入 config/tenant/default/license.txt"
    return verify_license(code)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--code")
    ap.add_argument("--tenant", default="default")
    args = ap.parse_args()
    if args.code:
        ok, info = verify_license(args.code)
    else:
        ok, info = verify_current(args.tenant)
    print("VALID" if ok else "INVALID", "--", info)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
