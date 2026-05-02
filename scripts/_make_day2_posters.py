"""Day 2 批量海报生成 —— 避开命令行中文参数的编码问题."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_quote_poster import make  # noqa: E402

POSTERS = [
    {
        "title": "5万行代码写了个AI公司操作系统",
        "subtitle": "9个AI员工 · Token经济 · 一个人活成一支军团",
        "output": "output/posters/script-02-poster.png",
        "theme": "gold",
    },
    {
        "title": "龙虾不够用，我直接造了9只",
        "subtitle": "从单只Agent到AI军团 · 一人公司正确打开方式",
        "output": "output/posters/script-03-poster.png",
        "theme": "hot",
    },
]


def main() -> int:
    project_root = Path(__file__).resolve().parent.parent
    for p in POSTERS:
        make(
            title=p["title"],
            subtitle=p["subtitle"],
            output=project_root / p["output"],
            theme=p["theme"],
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
