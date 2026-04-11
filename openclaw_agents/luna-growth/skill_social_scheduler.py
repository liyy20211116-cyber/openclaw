"""卢娜·增长部 — 社媒内容排期管理器
管理一周内的社交媒体发布计划。
"""
import json, os
from datetime import datetime, timedelta

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
DATA_DIR = os.path.join(ROOT, "data_raw")
os.makedirs(OUTPUT, exist_ok=True)

SCHEDULE_FILE = os.path.join(DATA_DIR, "content_schedule.json")

WEEKLY_SLOTS = {
    "monday": {"theme": "Deep Dive", "format": "long_article", "platform": "wechat"},
    "tuesday": {"theme": "Product Feature", "format": "short_video", "platform": "douyin"},
    "wednesday": {"theme": "Industry News", "format": "carousel", "platform": "xiaohongshu"},
    "thursday": {"theme": "Customer Story", "format": "short_post", "platform": "wechat"},
    "friday": {"theme": "Weekly Recap", "format": "summary", "platform": "douyin"},
}

def generate_weekly_plan(week_offset=0):
    today = datetime.now()
    monday = today - timedelta(days=today.weekday()) + timedelta(weeks=week_offset)

    plan = {
        "week_start": monday.strftime("%Y-%m-%d"),
        "generated_at": datetime.now().isoformat(),
        "slots": []
    }

    for i, (day_name, slot) in enumerate(WEEKLY_SLOTS.items()):
        date = monday + timedelta(days=i)
        plan["slots"].append({
            "date": date.strftime("%Y-%m-%d"),
            "day": day_name,
            "theme": slot["theme"],
            "format": slot["format"],
            "platform": slot["platform"],
            "title": "",
            "status": "planned",
            "notes": ""
        })

    return plan

def main():
    print("=== Content Schedule Manager ===\n")

    if os.path.exists(SCHEDULE_FILE):
        data = json.load(open(SCHEDULE_FILE, "r", encoding="utf-8"))
        print(f"Loaded existing schedule (week: {data.get('week_start', 'unknown')})")
    else:
        data = generate_weekly_plan()
        json.dump(data, open(SCHEDULE_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"Created new weekly plan (week: {data['week_start']})")

    print(f"\n--- Week of {data['week_start']} ---\n")
    for slot in data.get("slots", []):
        status_icon = {"planned": "[ ]", "draft": "[D]", "ready": "[R]", "published": "[V]"}.get(slot["status"], "[?]")
        print(f"  {status_icon} {slot['date']} {slot['day']:10s} | {slot['theme']:20s} | {slot['platform']:12s} | {slot.get('title', '-')}")

    next_week = generate_weekly_plan(week_offset=1)
    print(f"\n--- Next week preview ---")
    for slot in next_week["slots"][:3]:
        print(f"  [ ] {slot['date']} {slot['day']:10s} | {slot['theme']}")

    out_file = os.path.join(OUTPUT, f"content_schedule_{datetime.now():%Y%m%d}.json")
    json.dump(data, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\nSchedule: {out_file}")

if __name__ == "__main__":
    main()
