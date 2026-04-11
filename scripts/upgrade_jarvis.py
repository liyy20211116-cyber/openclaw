"""
Upgrade Jarvis agent capabilities in OpenClaw:
1. Load agent-specific enhanced skills
2. Update Jarvis identity with full IDENTITY.md
3. Ensure tool permissions and delegation config
"""
import json
from pathlib import Path

CONFIG_PATH = Path(r"C:\Users\Lenovo\.openclaw\openclaw.json")
AGENTS_DIR = Path(r"D:\FY003\openclaw_agents")

with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

changes = []

# --- 1. Load enhanced skill SKILL.md files from agent directories ---
# OpenClaw scans directories for SKILL-*.md or */SKILL.md patterns
# We need to ensure all agent SKILL files are reachable

# Collect all dirs that contain SKILL-*.md files
skill_dirs_to_add = set()
for agent_dir in AGENTS_DIR.iterdir():
    if agent_dir.is_dir():
        has_skills = list(agent_dir.glob("SKILL-*.md")) + list(agent_dir.glob("SKILL.md"))
        if has_skills:
            skill_dirs_to_add.add(str(agent_dir))

extra_dirs = data["skills"]["load"]["extraDirs"]
added_dirs = 0
for d in sorted(skill_dirs_to_add):
    if d not in extra_dirs:
        extra_dirs.append(d)
        added_dirs += 1
        changes.append(f"Added skill dir: {d}")

# --- 2. Update Jarvis agent identity with full context ---
agents_list = data.get("agents", {}).get("list", [])
for agent in agents_list:
    if agent.get("id") == "main":
        # Read the full IDENTITY.md
        identity_path = AGENTS_DIR / "jarvis-coo" / "IDENTITY.md"
        if identity_path.exists():
            identity_text = identity_path.read_text(encoding="utf-8")
            # Extract key personality traits for the theme
            agent["identity"]["theme"] = (
                "你是贾维斯（J.A.R.V.I.S.），一人公司执行总裁（COO），CEO 李原野的右手。\n"
                "你冷静、高效、结果导向，具备极强的任务拆解和跨部门协调能力。\n"
                "你拥有公司内最高运营权限（L4级），管理7个部门一号位。\n\n"
                "你的下属部门：\n"
                "- 技术部（赫敏·格兰杰）：开发、架构、自动化\n"
                "- 产品部（麦格教授）：需求、设计、验收\n"
                "- 内容增长部（卢娜·洛夫古德）：内容、素材、SEO\n"
                "- 销售商务部（弗雷德·韦斯莱）：客户开发、报价\n"
                "- 财务部（珀西·韦斯莱）：预算、记账、报表\n"
                "- 审计风控部（斯内普）：安全、审计、合规\n"
                "- 客户成功部（多比）：体验、反馈、知识库\n\n"
                "你可以通过子代理（魔法师、海绵）执行任务。\n"
                "魔法师负责执行类任务（开发、自动化、数据处理），海绵负责分析类任务（调研、整理、复核）。\n\n"
                "工作规则：\n"
                "1. CEO 下达目标后，你拆解成具体任务并分配到对应部门\n"
                "2. 使用 sessions_spawn 调度各部门 Agent\n"
                "3. 你的审批范围内的事项自行决策，不要事事请示 CEO\n"
                "4. 每个项目都要让珀西记录成本，让斯内普做质量检查\n"
                "5. 向 CEO 汇报用数据和结果说话，不用形容词堆砌"
            )
            changes.append("Updated Jarvis identity with full company context")

        # Ensure subagents config includes all workers
        if "subagents" not in agent:
            agent["subagents"] = {}
        agent["subagents"]["allowAgents"] = [
            "mofashi-worker", "haimian-worker", "kzt-dev"
        ]
        agent["subagents"]["maxConcurrent"] = 4

        # Ensure full tool profile
        if "tools" not in agent:
            agent["tools"] = {}
        agent["tools"]["profile"] = "full"
        changes.append("Confirmed Jarvis has full tools + subagent delegation")

# --- 3. Enhance worker agents with better identities ---
for agent in agents_list:
    if agent.get("id") == "mofashi-worker":
        agent["identity"]["theme"] = (
            "你是魔法师，贾维斯的核心执行助手。\n"
            "你擅长自动化操作、数据处理、信息检索、API调用、批量任务执行。\n"
            "你可以扮演以下部门角色执行任务：\n"
            "- 赫敏（技术部）：代码开发、测试、部署\n"
            "- 卢娜（内容部）：内容生成、数据分析\n"
            "- 弗雷德（销售部）：客户调研、方案生成\n"
            "- 珀西（财务部）：报表制作、数据统计\n"
            "接受贾维斯委派的任务并高效完成。"
        )
        agent["tools"]["profile"] = "full"
        changes.append("Enhanced mofashi-worker identity and tools")

    if agent.get("id") == "haimian-worker":
        agent["identity"]["theme"] = (
            "你是海绵，贾维斯的内部分析与复核助手。\n"
            "你擅长二次分析、结构化整理、方案评审、质量检查。\n"
            "你可以扮演以下部门角色执行分析任务：\n"
            "- 麦格教授（产品部）：需求分析、竞品调研\n"
            "- 斯内普（审计部）：安全审查、合规检查\n"
            "- 多比（客户部）：体验评估、反馈整理\n"
            "接受贾维斯委派的分析和审查任务。"
        )
        if "tools" not in agent:
            agent["tools"] = {}
        agent["tools"]["profile"] = "coding"
        changes.append("Enhanced haimian-worker identity and tools")

# --- Write back ---
with open(CONFIG_PATH, "w", encoding="utf-8", newline="\n") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# Verify
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    verify = json.load(f)

print("=== Jarvis Upgrade Complete ===")
for c in changes:
    print(f"  + {c}")
print(f"\nVerification:")
print(f"  extraDirs: {len(verify['skills']['load']['extraDirs'])} dirs")
print(f"  skill entries: {len(verify['skills']['entries'])} skills")
main_agent = next(a for a in verify['agents']['list'] if a['id'] == 'main')
print(f"  Jarvis tools.profile: {main_agent['tools']['profile']}")
print(f"  Jarvis subagents: {main_agent.get('subagents', {}).get('allowAgents', [])}")
print(f"  Jarvis identity length: {len(main_agent['identity']['theme'])} chars")
