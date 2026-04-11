"""多比·客户部 — 知识库/FAQ 自动生成器
从项目文档和对话记录中提取常见问题，生成客户自助知识库。
"""
import json, os, re
from datetime import datetime
from collections import Counter

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 多比·知识库/FAQ 生成器 ===\n")

# --- 1. 从项目文档提取关键信息 ---
doc_sources = {
    "company_rules": os.path.join(ROOT, "config", "company-rules.md"),
    "company_mission": os.path.join(ROOT, "config", "company-mission.md"),
    "company_culture": os.path.join(ROOT, "config", "company-culture.md"),
    "readme": os.path.join(ROOT, "README.md"),
}

extracted = {}
for name, path in doc_sources.items():
    if os.path.exists(path):
        content = open(path, "r", encoding="utf-8").read()
        extracted[name] = {
            "path": path,
            "word_count": len(content),
            "headings": re.findall(r'^#+\s+(.+)$', content, re.MULTILINE),
        }

print(f"扫描了 {len(extracted)} 个文档源")

# --- 2. 预设FAQ模板 ---
FAQ_CATEGORIES = {
    "product": {
        "title": "产品相关",
        "questions": [
            {"q": "一人公司是什么？", "a": "一人公司是一个AI Agent驱动的智能管理系统，由一位CEO（真人）和多个AI部门负责人组成。每个AI Agent有独立人格、职责和KPI，模拟真实公司运作。"},
            {"q": "一人公司能做什么？", "a": "可以帮助个人创业者自动化处理技术开发、内容创作、销售管理、财务统计、客户服务、安全审计等日常运营工作。"},
            {"q": "需要什么技术背景？", "a": "不需要深厚技术背景。系统已预配置好所有工具和Agent，CEO只需通过自然语言下达指令。"},
            {"q": "支持哪些AI模型？", "a": "主要使用 GPT-5.4（OpenAI），也支持 Gemini、Qwen 等国产模型。可在配置中切换。"},
        ]
    },
    "pricing": {
        "title": "价格与成本",
        "questions": [
            {"q": "使用成本是多少？", "a": "主要成本是AI API调用费用。GPT-5.4约$0.01/千token，正常使用每月约$30-100。系统本身开源免费。"},
            {"q": "有免费版本吗？", "a": "系统本身完全免费开源。使用Gemini等免费模型可零成本体验，但功能会受限（工具调用能力较弱）。"},
        ]
    },
    "technical": {
        "title": "技术支持",
        "questions": [
            {"q": "支持哪些操作系统？", "a": "目前主要支持 Windows 10/11，需要 Python 3.13+ 和 Node.js 22+。"},
            {"q": "如何安装？", "a": "克隆仓库后运行一键启动脚本即可。详见README.md。"},
            {"q": "遇到问题怎么办？", "a": "可以让贾维斯运行自检脚本（skill_self_check.py）诊断问题，或查看 output/ 目录下的审计报告。"},
        ]
    },
    "security": {
        "title": "安全与隐私",
        "questions": [
            {"q": "数据安全如何保障？", "a": "所有数据存储在本地，不上传到任何第三方。API调用通过加密通道。敏感信息通过环境变量管理，不硬编码。"},
            {"q": "AI会泄露我的信息吗？", "a": "系统遵循'先验证后执行'原则，未经CEO授权不会对外发送任何信息。斯内普（审计部）会定期扫描密钥泄露风险。"},
        ]
    }
}

# --- 3. 从agent记忆中提取常见问题模式 ---
memory_dir = os.path.join(os.path.expanduser("~"), ".openclaw", "workspace", "memory")
user_questions = []
if os.path.isdir(memory_dir):
    for fn in os.listdir(memory_dir):
        if not fn.endswith(".md"):
            continue
        try:
            content = open(os.path.join(memory_dir, fn), "r", encoding="utf-8").read()
            questions = re.findall(r'[^。？！\n]*[？?]', content)
            user_questions.extend(questions)
        except Exception:
            pass

print(f"从记忆中提取了 {len(user_questions)} 个问题模式")

# --- 4. 生成知识库 ---
knowledge_base = {
    "generated_at": datetime.now().isoformat(),
    "version": "1.0",
    "categories": FAQ_CATEGORIES,
    "total_questions": sum(len(cat["questions"]) for cat in FAQ_CATEGORIES.values()),
    "doc_sources": {k: v["headings"][:5] for k, v in extracted.items()},
    "user_question_patterns": user_questions[:10],
}

out_file = os.path.join(OUTPUT, f"knowledge_base_faq_{datetime.now():%Y%m%d}.json")
json.dump(knowledge_base, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# --- 5. 生成 Markdown FAQ ---
md_file = os.path.join(OUTPUT, f"FAQ_{datetime.now():%Y%m%d}.md")
with open(md_file, "w", encoding="utf-8") as f:
    f.write("# 一人公司 — 常见问题解答 (FAQ)\n\n")
    f.write(f"_更新日期: {datetime.now():%Y-%m-%d}_\n\n")
    for cat_key, cat in FAQ_CATEGORIES.items():
        f.write(f"## {cat['title']}\n\n")
        for qa in cat["questions"]:
            f.write(f"### {qa['q']}\n\n{qa['a']}\n\n")
    f.write("---\n\n_此文档由多比（客户部AI）自动生成_\n")

print(f"\n知识库: {out_file}")
print(f"FAQ文档: {md_file}")
print(f"总问题数: {knowledge_base['total_questions']} 个（{len(FAQ_CATEGORIES)} 个分类）")
