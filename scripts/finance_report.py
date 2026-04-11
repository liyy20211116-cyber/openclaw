"""珀西·财务部 — 运营成本与 Token 用量报告
统计 OpenClaw 日志中的 API 调用量，估算成本。
"""
import json, os, glob, re
from datetime import datetime, timedelta
from collections import defaultdict

ROOT = r"D:\FY003"
OPENCLAW_DIR = os.path.join(os.path.expanduser("~"), ".openclaw")
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

PRICE_PER_1K = {
    "gpt-5.4": {"input": 0.0025, "output": 0.01},
    "gpt-4.1-mini": {"input": 0.0004, "output": 0.0016},
    "gemini-3.1-flash-lite-preview": {"input": 0.0, "output": 0.0},
    "default": {"input": 0.001, "output": 0.004},
}

print("=== 珀西·财务报告生成器 ===\n")

# --- 1. 扫描 OpenClaw 日志 ---
log_dir = os.path.join(OPENCLAW_DIR, "logs")
usage = defaultdict(lambda: {"calls": 0, "input_tokens": 0, "output_tokens": 0})

if os.path.isdir(log_dir):
    log_files = sorted(glob.glob(os.path.join(log_dir, "*.log")))[-7:]
    for lf in log_files:
        try:
            for line in open(lf, "r", encoding="utf-8", errors="ignore"):
                if "model" in line and "tokens" in line.lower():
                    model_match = re.search(r'"model":\s*"([^"]+)"', line)
                    in_match = re.search(r'"input_tokens?":\s*(\d+)', line)
                    out_match = re.search(r'"output_tokens?":\s*(\d+)', line)
                    if model_match:
                        model = model_match.group(1)
                        usage[model]["calls"] += 1
                        if in_match:
                            usage[model]["input_tokens"] += int(in_match.group(1))
                        if out_match:
                            usage[model]["output_tokens"] += int(out_match.group(1))
        except Exception:
            pass
    print(f"扫描了 {len(log_files)} 个日志文件")
else:
    print(f"日志目录不存在: {log_dir}")

# --- 2. 计算成本 ---
total_cost = 0.0
model_costs = {}
for model, u in usage.items():
    prices = PRICE_PER_1K.get(model, PRICE_PER_1K["default"])
    cost = (u["input_tokens"] / 1000 * prices["input"] +
            u["output_tokens"] / 1000 * prices["output"])
    model_costs[model] = {**u, "cost_usd": round(cost, 4)}
    total_cost += cost

# --- 3. 统计项目文件资产 ---
file_stats = {"py": 0, "md": 0, "json": 0, "other": 0, "total_size_mb": 0}
for dirpath, _, filenames in os.walk(ROOT):
    if any(skip in dirpath for skip in ("node_modules", ".git", "__pycache__", "OpenClaw")):
        continue
    for fn in filenames:
        fp = os.path.join(dirpath, fn)
        try:
            file_stats["total_size_mb"] += os.path.getsize(fp) / (1024 * 1024)
        except Exception:
            pass
        ext = os.path.splitext(fn)[1].lower()
        if ext == ".py":
            file_stats["py"] += 1
        elif ext == ".md":
            file_stats["md"] += 1
        elif ext in (".json", ".json5"):
            file_stats["json"] += 1
        else:
            file_stats["other"] += 1
file_stats["total_size_mb"] = round(file_stats["total_size_mb"], 1)

# --- 4. 输出报告 ---
report = {
    "report_date": datetime.now().isoformat(),
    "period": "last_7_days",
    "api_usage": model_costs,
    "total_estimated_cost_usd": round(total_cost, 4),
    "project_assets": file_stats,
}

out_file = os.path.join(OUTPUT, f"finance_report_{datetime.now():%Y%m%d}.json")
json.dump(report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"\n--- 7 日 API 用量 ---")
for model, data in model_costs.items():
    print(f"  {model}: {data['calls']} 次调用, {data['input_tokens']+data['output_tokens']} tokens, ${data['cost_usd']}")
print(f"\n总估算成本: ${round(total_cost, 4)}")
print(f"\n--- 项目资产 ---")
print(f"  Python: {file_stats['py']} 文件 | Markdown: {file_stats['md']} 文件 | JSON: {file_stats['json']} 文件")
print(f"  总大小: {file_stats['total_size_mb']} MB")
print(f"\n报告已输出: {out_file}")
