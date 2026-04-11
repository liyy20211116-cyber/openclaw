"""贾维斯·自我学习系统 — 周反思报告
基于本周记忆和各部门报告，生成结构化周反思。
"""
import os, json, glob, re
from datetime import datetime, timedelta
from collections import Counter

ROOT = r"D:\FY003"
OPENCLAW_WS = os.path.join(os.path.expanduser("~"), ".openclaw", "workspace")
JARVIS_MEM = os.path.join(ROOT, "openclaw_agents", "jarvis-coo", "memory")
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 贾维斯·周反思报告 ===\n")

now = datetime.now()
week_start = now - timedelta(days=7)

# --- 1. 收集本周记忆 ---
ws_memory_dir = os.path.join(OPENCLAW_WS, "memory")
week_memories = []
if os.path.isdir(ws_memory_dir):
    for fn in sorted(os.listdir(ws_memory_dir)):
        if not fn.endswith(".md"):
            continue
        date_str = fn.replace(".md", "")
        try:
            fdate = datetime.strptime(date_str, "%Y-%m-%d")
            if fdate >= week_start:
                content = open(os.path.join(ws_memory_dir, fn), "r", encoding="utf-8").read()
                week_memories.append({"date": date_str, "content": content})
        except ValueError:
            pass
print(f"本周记忆文件: {len(week_memories)} 个")

# --- 2. 收集本周产出 ---
output_files = sorted(glob.glob(os.path.join(OUTPUT, "*.json")))
week_outputs = []
for of in output_files:
    try:
        mtime = datetime.fromtimestamp(os.path.getmtime(of))
        if mtime >= week_start:
            week_outputs.append(os.path.basename(of))
    except Exception:
        pass
print(f"本周产出文件: {len(week_outputs)} 个")

# --- 3. 收集本周 learnings ---
learnings_file = os.path.join(JARVIS_MEM, "learnings.md")
week_learnings = []
if os.path.exists(learnings_file):
    content = open(learnings_file, "r", encoding="utf-8").read()
    for block in re.split(r'\n---\n', content):
        ts_match = re.search(r'_(\d{4}-\d{2}-\d{2})', block)
        if ts_match:
            try:
                d = datetime.strptime(ts_match.group(1), "%Y-%m-%d")
                if d >= week_start:
                    text = re.sub(r'_\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}_\s*', '', block).strip()
                    if text:
                        week_learnings.append(text[:200])
            except ValueError:
                pass
print(f"本周学习记录: {len(week_learnings)} 条")

# --- 4. 检查 cron 任务执行情况 ---
cron_dir = os.path.join(os.path.expanduser("~"), ".openclaw", "cron", "runs")
cron_stats = {"total": 0, "success": 0, "error": 0}
if os.path.isdir(cron_dir):
    for fn in os.listdir(cron_dir):
        if not fn.endswith(".jsonl"):
            continue
        try:
            for line in open(os.path.join(cron_dir, fn), "r", encoding="utf-8"):
                entry = json.loads(line)
                ts = entry.get("ts", 0) / 1000
                if ts > week_start.timestamp():
                    cron_stats["total"] += 1
                    if entry.get("status") == "ok":
                        cron_stats["success"] += 1
                    else:
                        cron_stats["error"] += 1
        except Exception:
            pass
print(f"本周定时任务: {cron_stats['total']} 次（成功 {cron_stats['success']}, 失败 {cron_stats['error']}）")

# --- 5. 提取关键主题 ---
all_text = " ".join(
    [m["content"] for m in week_memories] +
    week_learnings
)
topic_keywords = {
    "ONES自动化": ["ONES", "建单", "审核", "闭环"],
    "Agent能力": ["环境", "工具", "Playwright", "权限", "基础设施"],
    "团队协作": ["赫敏", "斯内普", "珀西", "部门"],
    "内容创作": ["抖音", "视频", "内容", "脚本"],
    "基础设施": ["Gateway", "WebSocket", "飞书", "Token"],
}
topic_counts = {}
for topic, keywords in topic_keywords.items():
    count = sum(all_text.count(kw) for kw in keywords)
    if count > 0:
        topic_counts[topic] = count

# --- 6. 生成反思报告 ---
reflection = {
    "report_date": now.isoformat(),
    "period": f"{week_start:%Y-%m-%d} ~ {now:%Y-%m-%d}",
    "summary": {
        "memory_files_this_week": len(week_memories),
        "learnings_this_week": len(week_learnings),
        "outputs_this_week": len(week_outputs),
        "cron_tasks": cron_stats,
    },
    "top_topics": dict(sorted(topic_counts.items(), key=lambda x: -x[1])[:5]),
    "outputs_list": week_outputs,
    "key_learnings_sample": week_learnings[:5],
    "reflection_prompts": [
        f"本周最重要的突破是什么？",
        f"本周反复出现的问题是什么？如何从根本上解决？",
        f"本周哪些记忆可以压缩或归档？",
        f"下周最应优先推进的 1 件事是什么？",
        f"是否有需要升级 CEO 决策的事项？",
    ],
    "action_items": []
}

if cron_stats["error"] > cron_stats["success"]:
    reflection["action_items"].append("定时任务失败率过高，需排查原因")
if len(week_learnings) > 10:
    reflection["action_items"].append("本周学习记录较多，建议运行 memory_consolidate.py 压缩")
if not week_memories:
    reflection["action_items"].append("本周无记忆文件写入，记忆系统可能异常")

out_file = os.path.join(OUTPUT, f"weekly_reflection_{now:%Y%m%d}.json")
json.dump(reflection, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# --- 7. 同时生成 markdown 版本 ---
md_file = os.path.join(OUTPUT, f"weekly_reflection_{now:%Y%m%d}.md")
with open(md_file, "w", encoding="utf-8") as f:
    f.write(f"# 周反思报告 | {reflection['period']}\n\n")
    f.write(f"## 本周数据\n\n")
    f.write(f"- 记忆文件: {len(week_memories)} 个\n")
    f.write(f"- 学习记录: {len(week_learnings)} 条\n")
    f.write(f"- 产出文件: {len(week_outputs)} 个\n")
    f.write(f"- 定时任务: {cron_stats['total']} 次（成功率 {cron_stats['success']*100//(cron_stats['total'] or 1)}%）\n\n")
    f.write(f"## 本周热门主题\n\n")
    for topic, count in sorted(topic_counts.items(), key=lambda x: -x[1])[:5]:
        f.write(f"- {topic}: 提及 {count} 次\n")
    f.write(f"\n## 反思问题\n\n")
    for q in reflection["reflection_prompts"]:
        f.write(f"- [ ] {q}\n")
    f.write(f"\n## 待办事项\n\n")
    for a in reflection["action_items"]:
        f.write(f"- [ ] {a}\n")

print(f"\n反思报告: {out_file}")
print(f"Markdown版: {md_file}")
