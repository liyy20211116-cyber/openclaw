"""
skill_capability_gap.py — 纳威的技能：团队能力缺口分析
扫描所有 Agent 的 skills.json 和实际脚本，分析能力缺口并给出培训/补强建议
"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
AGENTS_DIR = os.path.join(PROJECT_ROOT, "openclaw_agents")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "hr")
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""

DEPT_NAMES = {
    "jarvis-coo": "执行办(贾维斯)", "hermione-tech": "技术部(赫敏)",
    "mcgonagall-product": "产品部(麦格)", "luna-growth": "增长部(露娜)",
    "fred-sales": "销售部(弗雷德)", "percy-finance": "财务部(珀西)",
    "snape-audit": "审计部(斯内普)", "dobby-customer": "客户部(多比)",
    "neville-hr": "人资部(纳威)",
}

ROLE_REQUIRED_CAPABILITIES = {
    "jarvis-coo": ["任务派发", "公司状态", "日报生成", "飞书通信", "浏览器自动化", "文件管理"],
    "hermione-tech": ["代码审查", "测试执行", "服务监控", "部署修复", "安全扫描", "性能监控"],
    "mcgonagall-product": ["需求分析", "PRD撰写", "验收检查", "竞品调研", "功能走查", "服务包管理"],
    "luna-growth": ["内容生产", "热点追踪", "平台分析", "内容排期", "素材设计", "数据统计"],
    "fred-sales": ["报价方案", "客户分析", "获客文案", "竞品定价", "线索评分", "漏斗分析"],
    "percy-finance": ["Token报告", "预算审核", "ROI计算", "成本追踪", "发票管理", "报表导出"],
    "snape-audit": ["安全扫描", "审计日志", "收支审计", "合规检查", "质量门禁", "渗透测试"],
    "dobby-customer": ["体验走查", "反馈收集", "满意度调查", "入职清单", "知识库", "客户健康"],
    "neville-hr": ["人事报告", "绩效评估", "花名册", "成长周报", "能力缺口", "培训计划"],
}


def call_llm(prompt, max_tokens=1200):
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是纳威，一人公司CHRO。你负责评估团队能力缺口，给出补强建议。输出简洁务实。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def analyze_agent(agent_id):
    agent_dir = os.path.join(AGENTS_DIR, agent_id)
    result = {
        "agent_id": agent_id,
        "dept": DEPT_NAMES.get(agent_id, agent_id),
        "registered_skills": 0,
        "script_skills": 0,
        "script_files": 0,
        "unregistered_scripts": [],
        "missing_scripts": [],
        "capability_coverage": 0,
    }

    skills_path = os.path.join(agent_dir, "skills.json")
    registered_scripts = set()
    if os.path.exists(skills_path):
        try:
            skills = json.loads(open(skills_path, encoding="utf-8").read())
            result["registered_skills"] = len(skills)
            for s in skills:
                if s.get("type") == "script":
                    result["script_skills"] += 1
                    registered_scripts.add(s.get("script", ""))
        except Exception:
            pass

    py_files = set(f for f in os.listdir(agent_dir) if f.startswith("skill_") and f.endswith(".py"))
    result["script_files"] = len(py_files)

    for pf in py_files:
        if pf not in registered_scripts:
            result["unregistered_scripts"].append(pf)

    for rs in registered_scripts:
        if rs and not os.path.exists(os.path.join(agent_dir, rs)):
            result["missing_scripts"].append(rs)

    required = ROLE_REQUIRED_CAPABILITIES.get(agent_id, [])
    if required:
        try:
            skills_text = open(skills_path, encoding="utf-8").read().lower() if os.path.exists(skills_path) else ""
            covered = sum(1 for cap in required if any(kw in skills_text for kw in cap))
            result["capability_coverage"] = round(covered / len(required) * 100, 1)
        except Exception:
            pass

    return result


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M")

    agents = [d for d in sorted(os.listdir(AGENTS_DIR))
              if os.path.isdir(os.path.join(AGENTS_DIR, d)) and d in DEPT_NAMES]

    analyses = []
    total_registered = 0
    total_unregistered = 0
    total_missing = 0
    gaps_found = []

    for agent_id in agents:
        a = analyze_agent(agent_id)
        analyses.append(a)
        total_registered += a["registered_skills"]
        total_unregistered += len(a["unregistered_scripts"])
        total_missing += len(a["missing_scripts"])
        if a["unregistered_scripts"] or a["missing_scripts"] or a["capability_coverage"] < 80:
            gaps_found.append(a)

    gap_summary_text = "\n".join(
        f"- {a['dept']}: 注册{a['registered_skills']}技能, 覆盖率{a['capability_coverage']}%, "
        f"未注册脚本{len(a['unregistered_scripts'])}个, 缺失脚本{len(a['missing_scripts'])}个"
        for a in analyses
    )

    prompt = f"""## 团队能力缺口分析

{gap_summary_text}

全公司注册技能: {total_registered} | 未注册脚本: {total_unregistered} | 缺失脚本: {total_missing}

请给出：
1. 最需要优先补强的 3 个部门及原因
2. 全公司共性短板
3. 下一步行动建议（3条内）"""

    analysis = call_llm(prompt)

    report = {
        "report_date": timestamp,
        "totals": {
            "agents": len(analyses),
            "total_skills": total_registered,
            "unregistered_scripts": total_unregistered,
            "missing_scripts": total_missing,
            "avg_coverage": round(sum(a["capability_coverage"] for a in analyses) / max(len(analyses), 1), 1),
        },
        "departments": analyses,
        "llm_analysis": analysis,
    }

    out_file = os.path.join(OUTPUT_DIR, f"capability_gap_{timestamp}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    avg_cov = report["totals"]["avg_coverage"]
    summary = (f"能力缺口分析: {len(analyses)} 部门 | 平均覆盖率 {avg_cov}% | "
               f"技能总数 {total_registered} | 需补强 {len(gaps_found)} 个部门")
    print(json.dumps({"ok": True, "summary": summary, "report": report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
