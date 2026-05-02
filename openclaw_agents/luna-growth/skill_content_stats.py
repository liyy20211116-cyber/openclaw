"""
skill_content_stats.py — 卢娜的技能：内容产出统计
统计 output 目录下的内容产出数量、类型和时间分布
"""
import json, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from _shared.output import SkillOutput
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUTPUT_ROOT = os.path.join(PROJECT_ROOT, "output")


def scan_outputs():
    stats = {"total_files": 0, "total_size_kb": 0, "by_type": defaultdict(int), "by_dir": defaultdict(int), "recent_files": []}
    now = time.time()
    week_ago = now - 7 * 86400

    if not os.path.isdir(OUTPUT_ROOT):
        return stats

    for root, _dirs, files in os.walk(OUTPUT_ROOT):
        rel_dir = os.path.relpath(root, OUTPUT_ROOT)
        for fname in files:
            if fname.startswith("."):
                continue
            fpath = os.path.join(root, fname)
            try:
                fstat = os.stat(fpath)
            except:
                continue

            ext = os.path.splitext(fname)[1].lower()
            stats["total_files"] += 1
            stats["total_size_kb"] += fstat.st_size / 1024
            stats["by_type"][ext or "other"] += 1
            stats["by_dir"][rel_dir if rel_dir != "." else "root"] += 1

            if fstat.st_mtime >= week_ago:
                stats["recent_files"].append({
                    "name": fname,
                    "dir": rel_dir,
                    "size_kb": round(fstat.st_size / 1024, 1),
                    "modified": time.strftime("%Y-%m-%d %H:%M", time.localtime(fstat.st_mtime)),
                })

    stats["total_size_kb"] = round(stats["total_size_kb"], 1)
    stats["by_type"] = dict(stats["by_type"])
    stats["by_dir"] = dict(stats["by_dir"])
    stats["recent_files"] = sorted(stats["recent_files"], key=lambda x: x["modified"], reverse=True)[:20]
    return stats


def main():
    stats = scan_outputs()
    recent_count = len(stats["recent_files"])

    out = SkillOutput()
    out.summary = f"内容统计: 总计 {stats['total_files']} 个文件 ({stats['total_size_kb']} KB), 近 7 天新增 {recent_count} 个"
    out.data = stats
    out.metrics["totalFiles"] = stats["total_files"]
    out.metrics["recentFiles"] = recent_count
    out.emit()


if __name__ == "__main__":
    main()
