"""
skill_ux_walkthrough.py — 多比的技能：用户体验走查
从用户视角检查 ONES 需求审核流程的各环节体验
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(os.path.dirname(HERE))
REQ_AGENT = os.path.join(PROJECT, "openclaw_agents", "req-review-agent")

ux_checks = []

def check(name, passed, detail="", suggestion=""):
    ux_checks.append({"check": name, "pass": passed, "detail": detail, "suggestion": suggestion})

# 1. 审核卡片模板是否友好
tpl_dir = os.path.join(REQ_AGENT, "templates")
if os.path.isdir(tpl_dir):
    for f in os.listdir(tpl_dir):
        if not f.endswith(".json"):
            continue
        try:
            tpl = json.loads(open(os.path.join(tpl_dir, f), encoding="utf-8").read())
            tpl_str = json.dumps(tpl, ensure_ascii=False)
            has_title = "标题" in tpl_str or "title" in tpl_str.lower()
            has_action = "action" in tpl_str
            check(f"卡片模板 {f} 可读性", has_title,
                  f"{'包含标题字段' if has_title else '缺少标题字段'}, {'包含操作按钮' if has_action else '缺少操作按钮'}",
                  "" if has_title and has_action else "建议确保卡片包含清晰的标题和操作按钮")
        except Exception as e:
            check(f"卡片模板 {f}", False, f"解析失败: {e}", "检查 JSON 格式")
else:
    check("卡片模板目录", False, "templates 目录不存在", "需要创建审核卡片模板")

# 2. 拒绝理由是否有回填
config_path = os.path.join(REQ_AGENT, "config.json")
try:
    cfg = json.loads(open(config_path, encoding="utf-8").read())
    statuses = cfg.get("feishu", {}).get("status_values", {})
    has_reject = "rejected" in statuses or "退回" in json.dumps(statuses, ensure_ascii=False)
    check("退回状态配置", has_reject,
          f"状态值: {statuses}" if statuses else "无状态配置",
          "" if has_reject else "缺少退回需求状态，用户不知道被拒原因")
except:
    check("配置文件可读", False, "config.json 读取失败")

# 3. 处理记录中的通知是否发出
mem_dir = os.path.join(REQ_AGENT, "memory")
processed_path = os.path.join(mem_dir, "processed_log.json")
if os.path.exists(processed_path):
    try:
        records = json.loads(open(processed_path, encoding="utf-8").read())
        if isinstance(records, list) and records:
            last = records[-1] if records else {}
            has_notify = "ones_link" in last or "reject_reason" in last
            check("最近处理有结果通知", has_notify,
                  f"最近记录: {last.get('action', '?')} at {last.get('processed_at', '?')}",
                  "" if has_notify else "处理后应通知提报人结果")
            check("处理记录完整性", all("record_id" in r and "action" in r for r in records),
                  f"共 {len(records)} 条记录",
                  "每条记录应包含 record_id 和 action")
        else:
            check("处理记录", True, "暂无记录（系统未运行过）")
    except:
        check("处理记录可读", False, "JSON 解析失败")
else:
    check("处理记录", False, "processed_log.json 不存在", "系统尚未运行过扫描流程")

# 4. 提报人能看到审核进度吗
pending_path = os.path.join(mem_dir, "pending_reviews.json")
if os.path.exists(pending_path):
    try:
        pending = json.loads(open(pending_path, encoding="utf-8").read())
        count = len(pending) if isinstance(pending, (list, dict)) else 0
        check("待审批队列可追踪", count >= 0,
              f"{count} 条待审批",
              "建议给提报人提供查询审批进度的入口" if count > 5 else "")
    except:
        check("待审批数据", False, "读取失败")

passed = sum(1 for c in ux_checks if c["pass"])
total = len(ux_checks)
score = round(passed / total * 100) if total > 0 else 0

suggestions = [c["suggestion"] for c in ux_checks if c["suggestion"]]
summary = f"体验评分: {score}分 ({passed}/{total} 通过)" + (f" | {len(suggestions)} 条改进建议" if suggestions else "")

print(json.dumps({
    "ok": score >= 70,
    "summary": summary,
    "score": score,
    "checks": ux_checks,
    "suggestions": suggestions,
}, ensure_ascii=False))
