"""
skill_onboarding_checklist.py — 多比的技能：客户入职检查清单
为新签约客户生成标准化入职流程和检查清单
"""
import json, os, sys, time, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from _shared.output import SkillOutput

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "onboarding")
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""


def call_llm(prompt, max_tokens=1200):
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是多比，一人公司客户成功官(CXO)。你擅长设计客户入职流程，确保客户获得良好的第一体验。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


ONBOARDING_TEMPLATE = {
    "day1": {
        "title": "Day 1 — 欢迎",
        "tasks": ["发送欢迎邮件+项目概要", "分享访问凭据和文档", "预约启动会议", "创建项目协作空间"],
    },
    "week1": {
        "title": "第1周 — 配置",
        "tasks": ["完成需求收集", "搭建开发/测试环境", "明确成功指标和KPI", "建立沟通节奏"],
    },
    "week2": {
        "title": "第2周 — 构建",
        "tasks": ["交付首个原型/MVP", "收集初步反馈", "基于反馈迭代", "项目中期回顾"],
    },
    "week4": {
        "title": "第4周 — 交付",
        "tasks": ["最终交付和移交", "客户团队培训", "文档移交", "满意度调查", "讨论后续维护"],
    },
}


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M")
    client = task_arg or "新客户"

    phases = {}
    total_tasks = 0
    for key, phase in ONBOARDING_TEMPLATE.items():
        tasks = [{"task": t, "done": False} for t in phase["tasks"]]
        phases[key] = {"title": phase["title"], "tasks": tasks}
        total_tasks += len(tasks)

    prompt = f"""为客户「{client}」定制入职建议。

标准流程已有 {total_tasks} 个任务项，覆盖 Day1 到第4周。
请补充 3 条针对 AI 一人公司产品的特殊入职建议（100字内）。"""

    extra_advice = call_llm(prompt)

    checklist = {
        "client": client,
        "generated_at": timestamp,
        "total_tasks": total_tasks,
        "phases": phases,
        "extra_advice": extra_advice,
    }

    out_file = os.path.join(OUTPUT_DIR, f"onboarding_{timestamp}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(checklist, f, ensure_ascii=False, indent=2)

    out = SkillOutput()
    out.summary = f"客户入职清单: {client} | {total_tasks} 个任务 | 4个阶段 | 已保存 {os.path.basename(out_file)}"
    out.data = checklist
    out.metrics["totalTasks"] = total_tasks
    out.emit()


if __name__ == "__main__":
    main()
