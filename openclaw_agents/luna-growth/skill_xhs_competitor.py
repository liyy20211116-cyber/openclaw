"""
skill_xhs_competitor.py — 卢娜的技能：小红书竞品分析
分析竞品博主的内容策略、粉丝互动、爆款模式。
依赖：npm install -g @lucasygu/redbook（需 Node.js >= 22）
"""
import json, subprocess, sys, os
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"


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
    raw_input = sys.argv[1] if len(sys.argv) > 1 else '{"keyword": "AI编程"}'

    try:
        params = json.loads(raw_input)
    except (json.JSONDecodeError, TypeError):
        params = {"keyword": raw_input}

    keyword = params.get("keyword", "AI编程")
    now = datetime.now().strftime("%Y%m%d_%H%M")

    search_result = run_redbook_cmd(
        ["search", keyword, "--sort", "最多点赞", "-o", "json"],
        timeout=30,
    )

    analysis = {
        "keyword": keyword,
        "search_status": "success" if search_result["ok"] else "error",
    }

    if search_result["ok"]:
        data = search_result.get("data", "")
        analysis["raw_data_preview"] = str(data)[:1000]
        analysis["recommendation"] = (
            f"已获取「{keyword}」的小红书热门数据。"
            "建议用 LLM 分析：1) 标题钩子模式 2) 封面风格 3) 互动率分布 4) 内容类型占比"
        )
    else:
        analysis["error"] = search_result.get("error", "unknown")

    report = {
        "ok": search_result["ok"],
        "summary": f"小红书竞品分析: 「{keyword}」 {'成功' if search_result['ok'] else '失败'}",
        "timestamp": now,
        "analysis": analysis,
    }

    report_path = OUTPUT_DIR / f"xhs_competitor_{now}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
