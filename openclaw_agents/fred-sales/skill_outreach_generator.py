"""
skill_outreach_generator.py — 弗雷德的技能：获客话术生成器
根据目标客户画像生成个性化获客文案（朋友圈/私信/邮件/电话脚本）
"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "outreach")
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""


def call_llm(prompt, max_tokens=1500):
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是弗雷德·韦斯莱，一人公司销售官(CSO)。你擅长写吸引人的销售文案，风格亲切但专业。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "max_tokens": max_tokens,
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
    target = task_arg or "中小企业老板，关注效率提升和降本增效，月营收50-500万"
    timestamp = time.strftime("%Y%m%d_%H%M")

    prompt = f"""## 获客文案生成

目标客户画像：{target}

我们的产品：AI 一人公司操作系统 — 用 AI Agent 团队替代传统部门，10 个 AI 角色覆盖技术、产品、增长、销售、财务等职能，帮企业降低人力成本、提升执行效率。

请为以下 4 个场景各生成 1 份文案：

### 1. 朋友圈（150字内，引发好奇，不要太硬广）
### 2. 微信私信（200字内，适合冷启动破冰）
### 3. 邮件模板（标题+正文，300字内，专业但不啰嗦）
### 4. 电话脚本（开场白+3个关键问题+收尾，适合30秒内建立兴趣）

每份文案都要：
- 聚焦客户痛点而非产品功能
- 有明确的行动号召（CTA）
- 自然不做作"""

    content = call_llm(prompt)

    out_file = os.path.join(OUTPUT_DIR, f"outreach_{timestamp}.md")
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(f"# 获客文案集 — {target[:30]}\n\n{content}\n")

    result = {
        "ok": True,
        "summary": f"获客文案生成完成: 4 个场景文案已保存到 {out_file}",
        "output_file": out_file,
        "target": target[:50],
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
