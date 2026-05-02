"""
skill_xhs_comment_sentiment.py — 卢娜的技能：小红书评论情感分析
分析笔记评论区的用户情感、高频词、用户痛点
"""
import json, subprocess, sys, os
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"


def call_llm(prompt, max_tokens=1200):
    import urllib.request
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是卢娜，一人公司增长官。你在做评论情感分析，请输出用户洞察。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8")).get("choices", [{}])[0].get("message", {}).get("content", "")
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def run_redbook(args, timeout=30):
    try:
        r = subprocess.run(["redbook"] + args, capture_output=True, text=True, encoding="utf-8", timeout=timeout,
                           env={**os.environ, "NODE_NO_WARNINGS": "1"})
        if r.returncode == 0:
            try:
                return {"ok": True, "data": json.loads(r.stdout)}
            except:
                return {"ok": True, "data": r.stdout[:2000]}
        return {"ok": False, "error": r.stderr[:300]}
    except FileNotFoundError:
        return {"ok": False, "error": "redbook CLI 未安装"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


def main():
    keyword = sys.argv[1] if len(sys.argv) > 1 else "AI工具推荐"
    try:
        p = json.loads(keyword)
        keyword = p.get("keyword", keyword)
    except:
        pass

    now = datetime.now().strftime("%Y%m%d_%H%M")

    search_result = run_redbook(["search", keyword, "--sort", "最多点赞", "-o", "json"])

    analysis = call_llm(f"""## 小红书评论情感分析 — 「{keyword}」

### 搜索数据
{str(search_result.get('data', '无数据'))[:2000]}

基于以上笔记的评论数据，请分析：
1. 用户情感分布（正面/中性/负面比例）
2. 高频评论关键词 Top 15
3. 用户最关心的 5 个问题/痛点
4. 购买意向信号（哪些评论暗示用户想付费）
5. 用户反对意见和顾虑
6. 运营建议：如何利用这些评论洞察优化我们的内容""")

    result = {
        "ok": search_result["ok"],
        "summary": f"小红书评论分析: 「{keyword}」 " + ("分析完成" if search_result["ok"] else f"数据获取失败: {search_result.get('error', '')}"),
        "keyword": keyword, "analysis": analysis,
    }
    (OUTPUT_DIR / f"xhs_comment_sentiment_{now}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
