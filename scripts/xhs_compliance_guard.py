from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


ENGAGEMENT_BAIT_PATTERNS = [
    r"评论\s*[：:]\s*\S+",
    r"评论区\s*(扣|打|发|留|回复)\s*\S+",
    r"(想要|需要|领取|获取|拿到|获得).{0,12}(评论|留言|私信|点赞|收藏|关注)",
    r"(点赞|收藏|关注|转发).{0,12}(送|领|抽|换|获取|获得)",
    r"(关注我|点个关注|先关注).{0,20}(下一条|后续|带你看|继续)",
    r"(抽奖|互关|互赞|互评|互藏|涨粉)",
]

HARD_SELL_PATTERNS = [
    r"(稳赚|暴富|保证赚钱|闭眼买)",
    r"(加微信|加我微信|VX|vx|私域).{0,8}(购买|付款|咨询|领取)",
]

UNSUPPORTED_ABSOLUTE_PATTERNS = [
    r"(每天|24小时).{0,12}(从不摸鱼|零情绪|不会出错|永不出错)",
    r"(成本|费用).{0,10}(只有|仅为|相当于).{0,10}(1/10|十分之一)",
    r"(真实存在|真的会干活).{0,20}(零情绪|从不摸鱼|24小时)",
]

AI_FLAVOR_TERMS = [
    "赋能",
    "闭环",
    "自动化",
    "矩阵",
    "转化",
    "商业化",
    "智能体",
    "系统",
    "提效",
    "降本增效",
    "生态",
    "链路",
]

REAL_DETAIL_TERMS = [
    "我",
    "今天",
    "昨天",
    "刚刚",
    "被下架",
    "审核",
    "删掉",
    "改掉",
    "卡住",
    "问题",
    "原因",
]


def _find_matches(text: str, patterns: list[str], code: str, message: str) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            issues.append(
                {
                    "code": code,
                    "message": message,
                    "pattern": pattern,
                    "sample": match.group(0),
                }
            )
    return issues


def audit_text(text: str) -> dict[str, Any]:
    issues: list[dict[str, str]] = []
    issues.extend(
        _find_matches(
            text,
            ENGAGEMENT_BAIT_PATTERNS,
            "engagement_bait",
            "疑似诱导点赞、评论、收藏、关注、私信等互动行为。",
        )
    )
    issues.extend(
        _find_matches(
            text,
            HARD_SELL_PATTERNS,
            "hard_sell_or_risky_promise",
            "疑似硬广导流或收益承诺。",
        )
    )
    issues.extend(
        _find_matches(
            text,
            UNSUPPORTED_ABSOLUTE_PATTERNS,
            "unsupported_absolute_claim",
            "疑似绝对化或难验证承诺，容易显得夸张或误导。",
        )
    )
    ai_term_hits = [term for term in AI_FLAVOR_TERMS if term in text]
    real_detail_hits = [term for term in REAL_DETAIL_TERMS if term in text]
    if len(ai_term_hits) >= 4 and len(real_detail_hits) < 2:
        issues.append(
            {
                "code": "ai_flavor",
                "message": "抽象营销词过密，缺少真实动作、真实卡点或个人经历。",
                "pattern": "AI_FLAVOR_TERMS",
                "sample": "、".join(ai_term_hits[:6]),
            }
        )
    return {
        "pass": len(issues) == 0,
        "issues": issues,
        "rules": [
            "不使用评论关键词换资料。",
            "不要求点赞、收藏、关注、私信作为获取资源的条件。",
            "不做收益承诺，不做硬广导流。",
            "不使用难验证的绝对化表达，例如 24 小时从不摸鱼、成本只有 1/10。",
            "用真实经历、过程复盘和连续内容替代互动诱导。",
            "抽象营销词不能堆叠，必须有具体动作、卡点或个人经历。",
        ],
    }


def audit_file(path: Path) -> dict[str, Any]:
    return audit_text(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    result = audit_file(args.path)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["pass"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
