"""
skill_douyin_video_analysis.py — 卢娜的技能：抖音视频数据分析
使用 Playwright 访问抖音搜索结果，分析视频数据（播放量/点赞/评论/转发）
输出爆款模式和内容策略建议
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
            {"role": "system", "content": "你是卢娜，一人公司增长官。你在分析抖音视频数据，请输出结构化的策略建议。"},
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
    videos = []
    error = None

    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            )
            page = ctx.new_page()
            page.set_default_timeout(30000)

            url = f"https://www.douyin.com/search/{keyword}?type=video"
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_timeout(5000)

            ss_path = str(OUTPUT_DIR / f"douyin_search_{now}.png")
            page.screenshot(path=ss_path)

            items = page.query_selector_all("[class*='search-result'] [class*='video'], [class*='PlayerContainer'], li[class*='result']")
            if not items:
                items = page.query_selector_all("li, div[class*='Video']")

            for i, item in enumerate(items[:20]):
                try:
                    text = item.inner_text()
                    lines = [l.strip() for l in text.split("\n") if l.strip()]
                    videos.append({"rank": i + 1, "title": lines[0] if lines else "", "stats": " | ".join(lines[1:3]) if len(lines) > 1 else "", "raw": text[:300]})
                except:
                    pass

            browser.close()
    except ImportError:
        error = "Playwright 未安装"
    except Exception as e:
        error = str(e)[:300]

    video_text = "\n".join([f"{v['rank']}. {v['title']} ({v['stats']})" for v in videos[:15]]) or "未能获取视频列表"

    analysis = call_llm(f"""## 抖音视频数据分析 — 关键词「{keyword}」

### 搜索结果 ({len(videos)} 条)
{video_text}

请分析：
1. 视频类型分布（知识口播/剧情/实操/对比/测评）
2. 标题钩子模式 Top 5（什么样的标题吸引点击）
3. 爆款共性特征（时长/风格/话题/争议性）
4. 内容策略建议：如果我们要做「{keyword}」相关内容，应该怎么切入
5. 建议的 3 个视频选题（标题+角度+预估数据）""")

    result = {
        "ok": len(videos) > 0 or error is None,
        "summary": f"抖音视频分析: 「{keyword}」获取 {len(videos)} 条视频" + (f" (错误: {error[:80]})" if error else ""),
        "keyword": keyword, "video_count": len(videos),
        "analysis": analysis, "videos": videos[:10],
    }
    (OUTPUT_DIR / f"douyin_video_analysis_{now}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
