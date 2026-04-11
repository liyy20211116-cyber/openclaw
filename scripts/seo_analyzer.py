"""卢娜·增长部 — SEO 与内容分析
分析已发布内容的关键词覆盖、标题优化建议。
"""
import json, os, re, urllib.request
from datetime import datetime
from collections import Counter

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 卢娜·SEO 与内容分析 ===\n")

# --- 1. 热门关键词库（AI/自动化/一人公司 赛道） ---
TRENDING_KEYWORDS = {
    "tier_1": ["AI Agent", "一人公司", "AI 自动化", "智能体", "AI 创业", "无代码", "AI 工具"],
    "tier_2": ["数字员工", "RPA", "AI 办公", "效率提升", "降本增效", "AI 助手", "智能客服"],
    "tier_3": ["ChatGPT", "Claude", "Cursor", "飞书", "OpenClaw", "多Agent", "LLM应用"],
}

# --- 2. 标题优化分析 ---
def analyze_title(title):
    score = 0
    suggestions = []

    if len(title) < 10:
        suggestions.append("标题过短，建议 15-30 字")
    elif len(title) > 40:
        suggestions.append("标题过长，建议控制在 30 字以内")
    else:
        score += 20

    has_number = bool(re.search(r'\d+', title))
    if has_number:
        score += 15
    else:
        suggestions.append("加入数字提升点击率（如'3个方法'、'节省50%'）")

    power_words = ["揭秘", "必看", "实战", "干货", "避坑", "省钱", "提效", "秘密", "真相"]
    if any(w in title for w in power_words):
        score += 15
    else:
        suggestions.append(f"加入吸引词（{'/'.join(power_words[:4])}等）")

    all_kw = TRENDING_KEYWORDS["tier_1"] + TRENDING_KEYWORDS["tier_2"]
    matched_kw = [kw for kw in all_kw if kw.lower() in title.lower()]
    score += min(30, len(matched_kw) * 10)
    if not matched_kw:
        suggestions.append("包含至少 1 个热门关键词")

    has_emoji = bool(re.search(r'[\U0001f600-\U0001f9ff\U00002702-\U000027b0]', title))
    if has_emoji:
        score += 10

    question_marks = title.count("？") + title.count("?")
    if question_marks:
        score += 10

    return {"title": title, "score": min(100, score), "suggestions": suggestions, "matched_keywords": matched_kw}

# --- 3. 内容关键词密度分析 ---
def analyze_content(text, target_keywords=None):
    if target_keywords is None:
        target_keywords = TRENDING_KEYWORDS["tier_1"] + TRENDING_KEYWORDS["tier_2"]

    word_count = len(text)
    kw_counts = {}
    for kw in target_keywords:
        count = text.lower().count(kw.lower())
        if count > 0:
            density = round(count * len(kw) / max(word_count, 1) * 100, 2)
            kw_counts[kw] = {"count": count, "density_pct": density}

    return {
        "word_count": word_count,
        "keyword_coverage": len(kw_counts),
        "total_target_keywords": len(target_keywords),
        "coverage_rate": round(len(kw_counts) / len(target_keywords) * 100, 1),
        "keyword_details": kw_counts
    }

# --- 4. 分析现有内容 ---
content_files = []
for dirpath, _, filenames in os.walk(os.path.join(ROOT, "output")):
    for fn in filenames:
        if fn.startswith("content_drafts") and fn.endswith(".json"):
            content_files.append(os.path.join(dirpath, fn))

results = []
if content_files:
    latest = sorted(content_files)[-1]
    data = json.load(open(latest, "r", encoding="utf-8"))
    drafts = data.get("drafts", [])
    for draft in drafts:
        title = draft.get("title", "")
        if title:
            analysis = analyze_title(title)
            results.append(analysis)
            print(f"[{analysis['score']}/100] {title}")
            for s in analysis["suggestions"]:
                print(f"    → {s}")
    print(f"\n分析了 {len(results)} 个标题")
else:
    print("未找到内容草稿文件，使用示例标题进行分析")
    sample_titles = [
        "AI Agent 如何帮一人公司节省 80% 工作量",
        "从物流经理到 AI 创业者",
        "5个 AI 工具让你的效率提升 10 倍",
    ]
    for t in sample_titles:
        analysis = analyze_title(t)
        results.append(analysis)
        print(f"[{analysis['score']}/100] {t}")
        for s in analysis["suggestions"]:
            print(f"    → {s}")

# --- 5. 输出报告 ---
report = {
    "generated_at": datetime.now().isoformat(),
    "trending_keywords": TRENDING_KEYWORDS,
    "title_analyses": results,
    "avg_score": round(sum(r["score"] for r in results) / max(len(results), 1), 1),
    "recommendations": [
        "每篇内容至少覆盖 2 个 tier_1 关键词",
        "标题长度控制在 15-30 字，包含数字和吸引词",
        "社交帖子标签优先使用 tier_1 关键词",
        "每周发布节奏: 3 篇短内容 + 1 篇深度文章",
    ]
}

out_file = os.path.join(OUTPUT, f"seo_analysis_{datetime.now():%Y%m%d}.json")
json.dump(report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"\nSEO 分析报告: {out_file}")
print(f"平均标题评分: {report['avg_score']}/100")
