from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import xhs_compliance_guard as guard  # noqa: E402


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def main() -> int:
    rejected = guard.audit_text("如果你也想看清单，评论：闭环")
    assert_true(not rejected["pass"], "direct comment-keyword CTA should fail")
    assert_true(any(item["code"] == "engagement_bait" for item in rejected["issues"]), "should flag engagement bait")

    rejected_card = guard.audit_text("想要清单，评论区扣 1")
    assert_true(not rejected_card["pass"], "comment bait in cards should fail")

    follow_bait = guard.audit_text("关注我，下一条带你看AI自己管AI")
    assert_true(not follow_bait["pass"], "follow bait should fail")
    assert_true(any(item["code"] == "engagement_bait" for item in follow_bait["issues"]), "should flag follow bait")

    absolute_claim = guard.audit_text("AI员工每天工作24小时、零情绪波动、从不摸鱼，成本只有传统团队的1/10")
    assert_true(not absolute_claim["pass"], "absolute unsupported claims should fail")
    assert_true(any(item["code"] == "unsupported_absolute_claim" for item in absolute_claim["issues"]), "should flag absolute claims")

    ai_flavor = guard.audit_text("一人公司系统通过智能体赋能商业闭环，实现自动化运营矩阵和多平台转化。")
    assert_true(not ai_flavor["pass"], "heavy abstract AI-marketing copy should fail")
    assert_true(any(item["code"] == "ai_flavor" for item in ai_flavor["issues"]), "should flag AI flavor")

    clean = guard.audit_text(
        "我把今天的尝试记录下来：先做内容，再观察反馈。下一篇会拆一张最小经营闭环清单。"
    )
    assert_true(clean["pass"], f"natural serialized sharing should pass: {clean}")

    incident = guard.audit_text(
        "第一条小红书被下架了。问题出在我写了评论关键词，平台把它判成诱导互动。"
        "这件事挺现实，我今天先把这句删掉，再让内容岗重写。"
    )
    assert_true(incident["pass"], f"real incident reflection should pass: {incident}")

    print("xhs compliance guard tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
