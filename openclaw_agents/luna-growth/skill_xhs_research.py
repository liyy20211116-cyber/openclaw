"""
skill_xhs_research.py — 卢娜的技能：小红书话题研究
搜索指定关键词，分析搜索结果，输出话题热度和竞争分析。
依赖：npm install -g @lucasygu/redbook（需 Node.js >= 22）
"""
import json, subprocess, sys, os
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"
KNOWLEDGE = PROJECT / "config" / "knowledge" / "xhs-operations.md"


def run_redbook_cmd(args: list[str], timeout: int = 60) -> dict:
    try:
        result = subprocess.run(
            ["redbook"] + args,
            capture_output=True, text=True, encoding="utf-8",
            timeout=timeout,
            env={**os.environ, "NODE_NO_WARNINGS": "1"},
        )
        if result.returncode != 0:
            return {"ok": False, "error": result.stderr[:500] or "Command failed"}
        try:
            return {"ok": True, "data": json.loads(result.stdout)}
        except json.JSONDecodeError:
            return {"ok": True, "data": result.stdout[:2000]}
    except FileNotFoundError:
        return {"ok": False, "error": "redbook CLI 未安装，请运行: npm install -g @lucasygu/redbook"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"超时 ({timeout}s)"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300]}


def main():
    keywords = sys.argv[1] if len(sys.argv) > 1 else "AI编程"

    if isinstance(keywords, str):
        try:
            params = json.loads(keywords)
            keywords = params.get("keywords", "AI编程")
        except (json.JSONDecodeError, TypeError):
            pass

    keyword_list = [k.strip() for k in keywords.split(",") if k.strip()]
    now = datetime.now().strftime("%Y%m%d_%H%M")

    results = []
    for kw in keyword_list[:5]:
        search_result = run_redbook_cmd(["search", kw, "--sort", "最多点赞", "-o", "json"], timeout=30)

        if search_result["ok"]:
            results.append({
                "keyword": kw,
                "status": "success",
                "data_preview": str(search_result["data"])[:500],
            })
        else:
            results.append({
                "keyword": kw,
                "status": "error",
                "error": search_result.get("error", "unknown"),
            })

    success_count = sum(1 for r in results if r["status"] == "success")
    summary = f"小红书话题研究: {len(keyword_list)} 个关键词, {success_count} 个成功"

    report = {
        "ok": success_count > 0,
        "summary": summary,
        "timestamp": now,
        "keywords": keyword_list,
        "results": results,
    }

    report_path = OUTPUT_DIR / f"xhs_research_{now}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
