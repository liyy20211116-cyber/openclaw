"""
skill_douyin_comment_analysis.py — 卢娜的技能：抖音热评情感分析
使用 Playwright 抓取热门视频评论，调用 LLM 做情感分析和用户洞察
"""
import json, sys
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
            {"role": "system", "content": "你是卢娜，一人公司增长官。你在分析评论数据，请输出用户情感洞察和运营建议。"},
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


def main():
    keyword = sys.argv[1] if len(sys.argv) > 1 else "AI创业"
    try:
        p = json.loads(keyword)
        keyword = p.get("keyword", keyword)
    except:
        pass

    now = datetime.now().strftime("%Y%m%d_%H%M")
    comments = []
    error = None

    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            page = ctx.new_page()
            page.set_default_timeout(30000)

            page.goto(f"https://www.douyin.com/search/{keyword}?type=video", wait_until="domcontentloaded")
            page.wait_for_timeout(5000)

            first_video = page.query_selector("a[href*='/video/']")
            if first_video:
                first_video.click()
                page.wait_for_timeout(3000)

                comment_els = page.query_selector_all("[class*='comment'] [class*='content'], [class*='CommentItem'] p")
                for el in comment_els[:50]:
                    try:
                        text = el.inner_text().strip()
                        if text and len(text) > 2:
                            comments.append(text[:200])
                    except:
                        pass

            page.screenshot(path=str(OUTPUT_DIR / f"douyin_comments_{now}.png"))
            browser.close()
    except ImportError:
        error = "Playwright 未安装"
    except Exception as e:
        error = str(e)[:300]

    comments_text = "\n".join([f"- {c}" for c in comments[:30]]) or "未能抓取评论"

    analysis = call_llm(f"""## 抖音热评情感分析 — 关键词「{keyword}」

### 抓取到 {len(comments)} 条评论
{comments_text}

请分析：
1. 情感分布：正面/中性/负面各占比多少
2. 高频关键词 Top 10
3. 用户核心诉求是什么（痛点/期望/疑问）
4. 争议话题有哪些
5. 内容运营启示：这些评论告诉我们用户真正关心什么，应该如何调整内容策略""")

    result = {
        "ok": len(comments) > 0 or error is None,
        "summary": f"抖音评论分析: 「{keyword}」获取 {len(comments)} 条评论" + (f" (错误: {error[:80]})" if error else ""),
        "keyword": keyword, "comment_count": len(comments),
        "analysis": analysis,
    }
    (OUTPUT_DIR / f"douyin_comment_analysis_{now}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
