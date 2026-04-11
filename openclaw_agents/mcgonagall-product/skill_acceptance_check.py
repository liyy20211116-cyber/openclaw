"""
skill_acceptance_check.py — 麦格教授的技能：验收检查
检查 ONES 需求审核项目的各环节完成度
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
REQ_AGENT = os.path.join(HERE, "..", "req-review-agent")

checklist = []

def check(name, condition, detail=""):
    checklist.append({"item": name, "pass": condition, "detail": detail})

# 核心脚本存在性
scripts = ["scan_and_send.py", "card_action_handler.py", "create_ones_issue.py", "ones_token_refresh.py"]
for s in scripts:
    exists = os.path.exists(os.path.join(REQ_AGENT, s))
    check(f"脚本 {s}", exists, "存在" if exists else "缺失")

# 配置完整性
config_path = os.path.join(REQ_AGENT, "config.json")
try:
    cfg = json.loads(open(config_path, encoding="utf-8").read())
    check("config.json 存在", True)
    check("飞书配置完整", "feishu" in cfg and "bitable_app_token" in cfg.get("feishu", {}),
          f"字段: {list(cfg.get('feishu', {}).keys())[:5]}")
    check("ONES 配置完整", "ones" in cfg and "product_uuids" in cfg.get("ones", {}),
          f"产品映射: {len(cfg.get('ones', {}).get('product_uuids', {}))} 个")
except:
    check("config.json 存在", False, "无法读取")

# 卡片模板
tpl_dir = os.path.join(REQ_AGENT, "templates")
if os.path.isdir(tpl_dir):
    templates = [f for f in os.listdir(tpl_dir) if f.endswith(".json")]
    check("审核卡片模板", len(templates) > 0, f"{len(templates)} 个模板文件")
else:
    check("审核卡片模板", False, "templates 目录不存在")

# 内存/日志
mem_dir = os.path.join(REQ_AGENT, "memory")
if os.path.isdir(mem_dir):
    mem_files = os.listdir(mem_dir)
    check("memory 目录", True, f"{len(mem_files)} 个文件")
    pending_path = os.path.join(mem_dir, "pending_reviews.json")
    if os.path.exists(pending_path):
        try:
            data = json.loads(open(pending_path, encoding="utf-8").read())
            count = len(data) if isinstance(data, list) else len(data.keys()) if isinstance(data, dict) else 0
            check("pending_reviews 数据", True, f"{count} 条记录")
        except:
            check("pending_reviews 数据", False, "解析失败")
    else:
        check("pending_reviews 数据", False, "文件不存在（尚未运行过扫描）")
else:
    check("memory 目录", False, "不存在")

passed = sum(1 for c in checklist if c["pass"])
total = len(checklist)
rate = round(passed / total * 100) if total > 0 else 0

summary = f"验收检查: {passed}/{total} 通过 ({rate}%)"
print(json.dumps({"ok": rate >= 80, "summary": summary, "checklist": checklist}, ensure_ascii=False))
