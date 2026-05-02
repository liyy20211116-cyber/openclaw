"""
skill_xhs_note_analysis.py — 卢娜的技能：小红书笔记深度分析
对搜索结果做爆款拆解：标题公式、封面风格、互动率、内容结构
"""
import json, subprocess, sys, os
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"


def call_llm(prompt, max_tokens=1500):
    import urllib.request
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是卢娜，一人公司增长官。你在做小红书笔记数据分析，请输出可复制的爆款公式。"},
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
        if r.returncode != 0:
            return {"ok": False, "error": r.stderr[:300]}
        try:
            return {"ok": True, "data": json.loads(r.stdout)}
        except:
            return {"ok": True, "data": r.stdout[:2000]}
    except FileNotFoundError:
        return {"ok": False, "error": "redbook CLI 未安装"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


def main():
    keyword = sys.argv[1] if len(sys.argv) > 1 else "AI副业"
    try:
        p = json.loads(keyword)
        keyword = p.get("keyword", keyword)
    except:
        pass

    now = datetime.now().strftime("%Y%m%d_%H%M")

    likes_result = run_redbook(["search", keyword, "--sort", "最多点赞", "-o", "json"])
    latest_result = run_redbook(["search", keyword, "--sort", "最新", "-o", "json"])

    data_text = f"### 按点赞排序\n{str(likes_result.get('data', ''))[:1500]}\n\n### 按最新排序\n{str(latest_result.get('data', ''))[:1500]}"

    analysis = call_llm(f"""## 小红书笔记深度分析 — 「{keyword}」

{data_text}

请完成：
1. 爆款标题公式 Top 5（提取规律：数字/疑问/对比/情绪/身份标签）
2. 内容类型分布（教程/经验分享/测评/清单/故事）
3. 互动率分析（点赞/收藏/评论的比例关系）
4. 封面风格趋势（文字封面/真人出镜/对比图/数据图）
5. 可复制的爆款模板 3 套（标题+结构+钩子+CTA）
6. 发布时间/频率建议""")

    result = {
        "ok": likes_result["ok"] or latest_result["ok"],
        "summary": f"小红书笔记分析: 「{keyword}」" + ("数据获取成功" if likes_result["ok"] else f"部分失败: {likes_result.get('error', '')}"),
        "keyword": keyword, "analysis": analysis,
    }
    (OUTPUT_DIR / f"xhs_note_analysis_{now}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
