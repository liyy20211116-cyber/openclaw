"""多比·客户部 — 客户反馈收集与分析
从飞书群聊历史中提取用户反馈，生成满意度分析。
"""
import json, os, glob
from datetime import datetime
from collections import Counter

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
WORKSPACE = os.path.join(os.path.expanduser("~"), ".openclaw", "workspace")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 多比·客户反馈收集器 ===\n")

POSITIVE_KEYWORDS = ["好的", "谢谢", "太棒了", "完美", "不错", "厉害", "牛", "赞", "感谢",
                     "excellent", "great", "perfect", "thanks", "good", "nice"]
NEGATIVE_KEYWORDS = ["不行", "有问题", "bug", "错误", "失败", "不对", "差", "慢",
                     "broken", "error", "wrong", "fail", "issue"]
FEATURE_KEYWORDS = ["能不能", "可以", "建议", "希望", "如果能", "需要",
                    "could", "should", "want", "need", "feature"]

# --- 1. 扫描本地对话记录 ---
conversations_dir = os.path.join(WORKSPACE, "conversations")
feedback_data = {"positive": [], "negative": [], "feature_requests": [], "neutral": []}
total_messages = 0

if os.path.isdir(conversations_dir):
    for fn in os.listdir(conversations_dir):
        if not fn.endswith(".json"):
            continue
        try:
            data = json.load(open(os.path.join(conversations_dir, fn), "r", encoding="utf-8"))
            messages = data if isinstance(data, list) else data.get("messages", [])
            for msg in messages:
                text = msg.get("content", msg.get("text", "")) if isinstance(msg, dict) else str(msg)
                if not text or len(text) < 5:
                    continue
                total_messages += 1
                text_lower = text.lower()
                if any(k in text_lower for k in NEGATIVE_KEYWORDS):
                    feedback_data["negative"].append(text[:200])
                elif any(k in text_lower for k in FEATURE_KEYWORDS):
                    feedback_data["feature_requests"].append(text[:200])
                elif any(k in text_lower for k in POSITIVE_KEYWORDS):
                    feedback_data["positive"].append(text[:200])
        except Exception:
            pass
    print(f"扫描了 {total_messages} 条消息")
else:
    print(f"对话记录目录不存在: {conversations_dir}")
    print("提示: 可配合飞书消息历史 API 获取更多数据")

# --- 2. 生成满意度指标 ---
pos = len(feedback_data["positive"])
neg = len(feedback_data["negative"])
feat = len(feedback_data["feature_requests"])
total = pos + neg + feat or 1

satisfaction = {
    "positive_ratio": round(pos / total * 100, 1),
    "negative_ratio": round(neg / total * 100, 1),
    "feature_request_ratio": round(feat / total * 100, 1),
    "nps_estimate": min(100, max(-100, (pos - neg) * 10))
}

print(f"\n满意度概览:")
print(f"  正面: {pos} 条 ({satisfaction['positive_ratio']}%)")
print(f"  负面: {neg} 条 ({satisfaction['negative_ratio']}%)")
print(f"  功能请求: {feat} 条 ({satisfaction['feature_request_ratio']}%)")
print(f"  NPS 估值: {satisfaction['nps_estimate']}")

# --- 3. 输出 ---
report = {
    "report_date": datetime.now().isoformat(),
    "total_messages_scanned": total_messages,
    "satisfaction": satisfaction,
    "sample_negative": feedback_data["negative"][:5],
    "sample_feature_requests": feedback_data["feature_requests"][:5],
    "sample_positive": feedback_data["positive"][:3],
}

out_file = os.path.join(OUTPUT, f"customer_feedback_{datetime.now():%Y%m%d}.json")
json.dump(report, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"\n反馈报告: {out_file}")
