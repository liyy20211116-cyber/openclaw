"""卢娜·增长部 — 内容素材生成器
基于 AI 新闻和行业动态，生成社交媒体帖子草稿。
"""
import json, os, glob
from datetime import datetime

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
DATA_RAW = os.path.join(ROOT, "data_raw")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 卢娜·内容素材生成器 ===\n")

# --- 1. 加载最新新闻数据 ---
news_files = sorted(glob.glob(os.path.join(DATA_RAW, "news_*.json")))
if not news_files:
    print("没有找到新闻数据文件。请先运行 fetch_news.py")
    exit(1)

latest = news_files[-1]
data = json.load(open(latest, "r", encoding="utf-8"))
items = data.get("items", [])
print(f"加载了 {len(items)} 条新闻 (来源: {os.path.basename(latest)})")

# --- 2. 生成内容大纲 ---
templates = [
    {
        "type": "daily_digest",
        "title": f"AI 日报 | {datetime.now():%Y-%m-%d}",
        "format": "每日精选 {count} 条行业动态",
        "items_limit": 5
    },
    {
        "type": "deep_dive",
        "title": "深度解读",
        "format": "选取 1 条重要新闻做 500 字深度分析",
        "items_limit": 1
    },
    {
        "type": "social_post",
        "title": "社交媒体帖子",
        "format": "140 字以内 + 3 个标签",
        "items_limit": 3
    }
]

drafts = []
for tpl in templates:
    selected = items[:tpl["items_limit"]]
    draft = {
        "type": tpl["type"],
        "title": tpl["title"],
        "instruction": tpl["format"],
        "source_news": [{"title": n["title"], "link": n.get("link", "")} for n in selected],
        "draft_content": "",
        "status": "待编辑"
    }
    drafts.append(draft)
    print(f"\n[{tpl['type']}] {tpl['title']}")
    for n in selected:
        print(f"  - {n['title'][:60]}")

# --- 3. 生成内容排期建议 ---
schedule_suggestion = {
    "monday": "深度行业分析文章",
    "tuesday": "产品功能亮点展示",
    "wednesday": "AI 日报",
    "thursday": "客户案例/使用技巧",
    "friday": "一周回顾 + 下周预告",
    "weekend": "轻松话题/团队文化"
}

# --- 4. 输出 ---
output_data = {
    "generated_at": datetime.now().isoformat(),
    "drafts": drafts,
    "weekly_schedule": schedule_suggestion,
    "total_news_available": len(items)
}

out_file = os.path.join(OUTPUT, f"content_drafts_{datetime.now():%Y%m%d}.json")
json.dump(output_data, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"\n内容素材已输出: {out_file}")
print(f"共生成 {len(drafts)} 份草稿，待进一步编辑")
