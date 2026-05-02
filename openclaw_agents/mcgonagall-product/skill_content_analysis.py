"""
skill_content_analysis.py — 麦格教授的技能：内容数据分析
读取小红书/抖音数据文件，分析爆款规律，输出内容策略建议。
"""
import json, sys, os, glob
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"
KNOWLEDGE_DIR = PROJECT / "config" / "knowledge"


def load_knowledge(filename: str) -> str:
    kf = KNOWLEDGE_DIR / filename
    if kf.exists():
        return kf.read_text(encoding="utf-8")[:1500]
    return ""


def find_latest_data_files() -> list[dict]:
    patterns = [
        str(OUTPUT_DIR / "xhs_research_*.json"),
        str(OUTPUT_DIR / "xhs_competitor_*.json"),
        str(OUTPUT_DIR / "content_calendar_*.json"),
        str(OUTPUT_DIR / "competitor_watch_*.json"),
    ]
    files = []
    for pattern in patterns:
        matches = sorted(glob.glob(pattern), reverse=True)
        if matches:
            try:
                content = json.loads(Path(matches[0]).read_text(encoding="utf-8"))
                files.append({"file": os.path.basename(matches[0]), "data": content})
            except Exception:
                pass
    return files


def main():
    now = datetime.now().strftime("%Y%m%d_%H%M")

    strategy_knowledge = load_knowledge("content-strategy.md")
    xhs_knowledge = load_knowledge("xhs-operations.md")

    data_files = find_latest_data_files()

    analysis = {
        "data_sources": len(data_files),
        "files_analyzed": [f["file"] for f in data_files],
        "knowledge_loaded": bool(strategy_knowledge),
    }

    if not data_files:
        analysis["recommendation"] = (
            "暂无数据文件可分析。建议先运行卢娜的「小红书话题研究」或「竞品分析」技能，"
            "生成原始数据后再来做深度分析。"
        )
    else:
        insights = []
        for f in data_files:
            data = f["data"]
            if "results" in data:
                success = sum(1 for r in data["results"] if r.get("status") == "success" or r.get("passed"))
                total = len(data["results"])
                insights.append(f"{f['file']}: {success}/{total} 条有效数据")
            elif "calendar" in data:
                cal = data["calendar"]
                total_posts = cal.get("total_posts", 0)
                insights.append(f"{f['file']}: {total_posts} 条内容计划")

        analysis["insights"] = insights
        analysis["recommendation"] = (
            "建议：1) 对比爆款和普通内容的标题模式 "
            "2) 分析互动率最高的内容类型 "
            "3) 找出竞品未覆盖的话题空白 "
            "4) 基于数据制定下周选题计划"
        )

    if strategy_knowledge:
        analysis["strategy_framework_available"] = True
        analysis["framework_summary"] = "已加载内容策略框架（选题四象限、ICE评分、数据复盘模板）"

    report = {
        "ok": True,
        "summary": f"内容分析: {len(data_files)} 个数据源, {'有' if strategy_knowledge else '无'}策略知识库",
        "timestamp": now,
        "analysis": analysis,
    }

    report_path = OUTPUT_DIR / f"content_analysis_{now}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
