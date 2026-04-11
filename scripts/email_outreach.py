"""弗雷德·销售部 — 邮件模板与外联管理
生成个性化的销售邮件和跟进模板。（不直接发送，生成草稿供确认）
"""
import json, os
from datetime import datetime
from jinja2 import Template

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
DATA_DIR = os.path.join(ROOT, "data_raw")
os.makedirs(OUTPUT, exist_ok=True)

print("=== 弗雷德·邮件外联管理 ===\n")

EMAIL_TEMPLATES = {
    "cold_intro": {
        "subject": "AI 自动化如何帮助 {{company}} 节省 {{hours}} 小时/周",
        "body": """{{contact_name}} 您好，

我是野子哥，一人公司的创始人。我注意到 {{company}} 在 {{industry}} 领域的出色表现。

我们专注于帮助企业通过 AI Agent 自动化降本增效。根据同行业客户的经验，通常可以：
- 节省 {{hours}} 小时/周的重复性工作
- 减少 30-50% 的人工操作错误
- 24/7 不间断处理日常事务

如果您有兴趣了解具体方案，我可以准备一份针对 {{company}} 的分析报告。

期待交流！

野子哥
一人公司 | AI 自动化专家"""
    },
    "follow_up": {
        "subject": "Re: AI 自动化方案 — {{company}} 跟进",
        "body": """{{contact_name}} 您好，

上次提到的 AI 自动化方案，我这边已经做了一些初步分析。

根据 {{company}} 的业务特点，我建议从以下场景切入：
1. {{scenario_1}}
2. {{scenario_2}}

预计实施周期 2-4 周，投资回报期约 3 个月。

方便的话，我们可以安排 30 分钟的线上演示。您看这周什么时间合适？

野子哥"""
    },
    "thank_you": {
        "subject": "感谢 {{company}} 的信任 — 项目启动确认",
        "body": """{{contact_name}} 您好，

感谢选择与我们合作！项目启动相关信息已整理如下：

项目名称: {{project_name}}
启动日期: {{start_date}}
预计交付: {{end_date}}
项目经理: 贾维斯（AI COO）

接下来我会发送详细的项目计划书，有任何问题随时联系。

野子哥"""
    }
}

def generate_email(template_name, variables):
    if template_name not in EMAIL_TEMPLATES:
        print(f"未知模板: {template_name}")
        print(f"可用模板: {', '.join(EMAIL_TEMPLATES.keys())}")
        return None

    tpl = EMAIL_TEMPLATES[template_name]
    subject = Template(tpl["subject"]).render(**variables)
    body = Template(tpl["body"]).render(**variables)

    draft = {
        "template": template_name,
        "subject": subject,
        "body": body,
        "variables": variables,
        "generated_at": datetime.now().isoformat(),
        "status": "draft"
    }

    out_file = os.path.join(OUTPUT, f"email_draft_{template_name}_{datetime.now():%Y%m%d%H%M}.json")
    json.dump(draft, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"主题: {subject}")
    print(f"草稿已保存: {out_file}")
    print(f"\n--- 邮件预览 ---\n{body}\n--- 预览结束 ---")
    return out_file

if __name__ == "__main__":
    import sys
    if "--demo" in sys.argv:
        generate_email("cold_intro", {
            "contact_name": "张总",
            "company": "示例科技",
            "industry": "电商物流",
            "hours": "15"
        })
    else:
        print("可用模板:")
        for name, tpl in EMAIL_TEMPLATES.items():
            print(f"  {name}: {tpl['subject']}")
        print(f"\n用法: python email_outreach.py --demo")
