"""
skill_service_packager.py — 麦格教授的技能：服务包定义与管理
定义和管理可销售的标准化服务包，支持定价策略和产品目录维护
"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data_raw")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "product")
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""

DEFAULT_SERVICES = [
    {
        "id": "SVC-001", "name_cn": "AI 工作流自动化咨询",
        "description": "分析客户工作流，识别自动化机会，输出可执行方案",
        "deliverables": ["工作流分析报告", "自动化机会图谱", "实施路线图", "ROI 测算"],
        "duration": "1 周", "price": 5000, "currency": "CNY", "status": "active",
    },
    {
        "id": "SVC-002", "name_cn": "定制 AI Agent 开发",
        "description": "为特定业务流程开发和部署定制 AI Agent",
        "deliverables": ["需求文档", "定制 Agent 代码", "部署指南", "30天支持"],
        "duration": "2-4 周", "price": 15000, "currency": "CNY", "status": "active",
    },
    {
        "id": "SVC-003", "name_cn": "AI 转型工作坊",
        "description": "半天工作坊，教团队高效使用 AI 工具",
        "deliverables": ["工作坊材料", "实操练习", "工具推荐清单", "后续答疑"],
        "duration": "4 小时", "price": 3000, "currency": "CNY", "status": "active",
    },
    {
        "id": "SVC-004", "name_cn": "月度 AI 运维服务",
        "description": "持续的 AI Agent 监控、优化和技术支持",
        "deliverables": ["月度绩效报告", "Agent 调优", "优先级支持", "新功能实现"],
        "duration": "按月", "price": 3000, "currency": "CNY", "status": "active",
    },
]


def call_llm(prompt, max_tokens=1000):
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是麦格教授，一人公司首席产品官(CPO)。你擅长设计和优化产品服务包，定价精准。"},
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


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M")

    catalog_file = os.path.join(DATA_DIR, "service_catalog.json")
    if os.path.exists(catalog_file):
        try:
            catalog = json.loads(open(catalog_file, encoding="utf-8").read())
        except Exception:
            catalog = {"services": DEFAULT_SERVICES}
    else:
        catalog = {"company": "一人公司", "created_at": timestamp, "services": DEFAULT_SERVICES}
        with open(catalog_file, "w", encoding="utf-8") as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)

    services = catalog.get("services", [])
    active = [s for s in services if s.get("status") == "active"]
    total_monthly = sum(s.get("price", 0) for s in active)

    prompt = f"""## 服务包评估
当前活跃服务 {len(active)} 个，月潜在收入 CNY{total_monthly:,}：
{json.dumps(active, ensure_ascii=False, indent=2)}

{f'补充需求: {task_arg}' if task_arg else ''}

请评估：
1. 当前服务包是否覆盖目标客户的核心需求
2. 定价是否合理（考虑市场竞争力）
3. 建议新增或调整的服务包（如有）
简洁输出，不超过 300 字。"""

    analysis = call_llm(prompt)

    report = {
        "timestamp": timestamp,
        "active_services": len(active),
        "monthly_potential": total_monthly,
        "annual_potential": total_monthly * 12,
        "catalog": active,
        "analysis": analysis,
    }

    out_file = os.path.join(OUTPUT_DIR, f"service_catalog_{timestamp}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    summary = f"服务包管理: {len(active)} 个活跃服务 | 月潜在收入 CNY{total_monthly:,} | 年收入 CNY{total_monthly*12:,}"
    print(json.dumps({"ok": True, "summary": summary, "report": report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
