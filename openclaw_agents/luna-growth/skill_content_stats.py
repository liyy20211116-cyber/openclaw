"""
skill_content_stats.py — 卢娜的技能：内容产出统计
扫描 output 目录，统计各类内容的产出数量和时间
"""
import json, os, time
from datetime import datetime

PROJECT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT = os.path.join(PROJECT, "output")

stats = {"scripts": 0, "videos": 0, "articles": 0, "others": 0, "total_size_mb": 0, "recent_files": []}

if not os.path.isdir(OUTPUT):
    print(json.dumps({"ok": True, "summary": "output 目录不存在，尚无内容产出", "stats": stats}, ensure_ascii=False))
    exit()

all_files = []
for root, dirs, files in os.walk(OUTPUT):
    for f in files:
        fpath = os.path.join(root, f)
        try:
            size = os.path.getsize(fpath)
            mtime = os.path.getmtime(fpath)
        except:
            continue
        ext = os.path.splitext(f)[1].lower()
        stats["total_size_mb"] += size / (1024 * 1024)
        if ext in (".txt", ".md"):
            stats["scripts"] += 1
        elif ext in (".mp4", ".avi", ".mkv", ".webm"):
            stats["videos"] += 1
        elif ext in (".html", ".doc", ".docx", ".pdf"):
            stats["articles"] += 1
        else:
            stats["others"] += 1
        all_files.append({"name": f, "size_kb": round(size / 1024, 1), "modified": datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")})

stats["total_size_mb"] = round(stats["total_size_mb"], 2)
all_files.sort(key=lambda x: x["modified"], reverse=True)
stats["recent_files"] = all_files[:10]

total = stats["scripts"] + stats["videos"] + stats["articles"] + stats["others"]
summary = f"内容总产出: {total} 个文件 ({stats['total_size_mb']}MB) | 脚本: {stats['scripts']} / 视频: {stats['videos']} / 文档: {stats['articles']}"
print(json.dumps({"ok": True, "summary": summary, "stats": stats}, ensure_ascii=False))
