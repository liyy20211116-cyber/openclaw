"""麦格·产品部 — 竞品与市场扫描
收集 AI Agent / 一人公司 赛道的竞品信息和市场动态。
"""
import json, os, urllib.request
from datetime import datetime

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 麦格·竞品市场扫描 ===\n")

COMPETITORS = [
    {"name": "AutoGPT", "url": "https://github.com/Significant-Gravitas/AutoGPT", "category": "AI Agent"},
    {"name": "CrewAI", "url": "https://github.com/crewAIInc/crewAI", "category": "Multi-Agent"},
    {"name": "MetaGPT", "url": "https://github.com/geekan/MetaGPT", "category": "Multi-Agent"},
    {"name": "OpenDevin", "url": "https://github.com/OpenDevin/OpenDevin", "category": "Coding Agent"},
    {"name": "Langchain", "url": "https://github.com/langchain-ai/langchain", "category": "LLM Framework"},
    {"name": "Dify", "url": "https://github.com/langgenius/dify", "category": "LLM Platform"},
    {"name": "Coze", "url": "https://www.coze.com", "category": "Bot Platform"},
]

results = []
for comp in COMPETITORS:
    info = {"name": comp["name"], "category": comp["category"], "url": comp["url"]}

    if "github.com" in comp["url"]:
        parts = comp["url"].rstrip("/").split("/")
        owner, repo = parts[-2], parts[-1]
        api_url = f"https://api.github.com/repos/{owner}/{repo}"
        try:
            req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
            data = json.loads(urllib.request.urlopen(req, timeout=15).read().decode())
            info["stars"] = data.get("stargazers_count", 0)
            info["forks"] = data.get("forks_count", 0)
            info["updated"] = data.get("updated_at", "")[:10]
            info["description"] = data.get("description", "")[:100]
            info["language"] = data.get("language", "")
            print(f"  {comp['name']}: ⭐{info['stars']:,} | 🍴{info['forks']:,} | 更新: {info['updated']}")
        except Exception as e:
            info["error"] = str(e)
            print(f"  {comp['name']}: 获取失败 ({e})")
    else:
        info["note"] = "非 GitHub 项目，需手动检查"
        print(f"  {comp['name']}: 非 GitHub，跳过自动抓取")

    results.append(info)

report = {
    "scan_date": datetime.now().isoformat(),
    "competitors": results,
    "market_insights": {
        "trend_1": "Multi-Agent 框架是当前热点，CrewAI / MetaGPT 增长迅速",
        "trend_2": "代码生成 Agent (OpenDevin/Cursor) 率先实现商业化",
        "trend_3": "企业级 Agent 平台 (Dify/Coze) 竞争激烈",
        "our_position": "一人公司 OS：面向个人创业者的全栈 Agent 管理系统，差异化定位"
    }
}

out_file = os.path.join(OUTPUT, f"competitive_scan_{datetime.now():%Y%m%d}.json")
json.dump(report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"\n竞品扫描报告: {out_file}")
