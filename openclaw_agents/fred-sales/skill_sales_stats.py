"""
skill_sales_stats.py — 弗雷德的技能：销售数据统计
统计商务方案、客户记录和销售漏斗数据
"""
import json, os, time
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUTPUT_ROOT = os.path.join(PROJECT_ROOT, "output")


def scan_sales_outputs():
    stats = {
        "proposals": 0, "customers": 0, "total_files": 0,
        "by_week": defaultdict(int), "recent": [],
    }
    now = time.time()
    dirs_to_scan = ["proposals", "customers", "quotes"]

    for d in dirs_to_scan:
        dpath = os.path.join(OUTPUT_ROOT, d)
        if not os.path.isdir(dpath):
            continue
        for fname in os.listdir(dpath):
            if fname.startswith("."):
                continue
            fpath = os.path.join(dpath, fname)
            if not os.path.isfile(fpath):
                continue
            stats["total_files"] += 1
            if d == "proposals":
                stats["proposals"] += 1
            elif d == "customers":
                stats["customers"] += 1

            try:
                mtime = os.stat(fpath).st_mtime
                week = time.strftime("%Y-W%W", time.localtime(mtime))
                stats["by_week"][week] += 1
                if now - mtime < 7 * 86400:
                    stats["recent"].append({
                        "name": fname, "dir": d,
                        "modified": time.strftime("%Y-%m-%d", time.localtime(mtime)),
                    })
            except:
                pass

    stats["by_week"] = dict(stats["by_week"])
    stats["recent"] = sorted(stats["recent"], key=lambda x: x["modified"], reverse=True)[:10]
    return stats


def main():
    stats = scan_sales_outputs()

    funnel = {
        "leads": stats["customers"],
        "proposals_sent": stats["proposals"],
        "closed": 0,
        "conversion_rate": f"{stats['proposals'] / max(stats['customers'], 1) * 100:.0f}%" if stats["customers"] > 0 else "N/A",
    }

    result = {
        "ok": True,
        "summary": f"销售统计: {stats['proposals']} 个方案, {stats['customers']} 个客户画像, 近7天新增 {len(stats['recent'])} 个文件",
        "stats": stats,
        "funnel": funnel,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
