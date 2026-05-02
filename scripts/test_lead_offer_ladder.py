from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def main() -> int:
    ladder = json.loads((ROOT / "config" / "lead-offer-ladder.json").read_text(encoding="utf-8"))
    offers = ladder["offers"]
    ids = {offer["id"] for offer in offers}
    expected = {"FREE-001", "DIAG-099", "CONSULT-399", "BOOT-999", "PACK-2999", "OS-999-2999-9999", "RET-399"}
    assert_true(expected.issubset(ids), "missing offer tier")
    text = json.dumps(ladder, ensure_ascii=False)
    assert_true("评论：闭环" not in text and "私信我“闭环”" not in text, "must not use engagement bait")
    assert_true("不承诺" in text, "must include no-promise boundaries")
    assert_true("系统是工具，不承诺自动盈利" in text, "OS boundary missing")
    assert_true(any(offer["price_cny"] == 0 for offer in offers), "free public trust offer missing")
    assert_true(any(offer["price_cny"] == 999 for offer in offers), "starter package missing")
    print("lead offer ladder tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
