"""
skill_video_link_analyzer.py — 卢娜的技能：视频链接内容分析
接收一个视频链接（抖音/B站/小红书/快手），提取视频标题、描述、评论、数据，
并用 LLM 分析内容结构和创作手法
"""
import json, sys, re
from pathlib import Path
from datetime import datetime

PROJECT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT / "output"
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"


def call_llm(prompt, max_tokens=2000):
    import urllib.request
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是卢娜，一人公司增长官。你在拆解视频内容，请输出详细的内容结构分析和可复用的创作方法论。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read().decode("utf-8")).get("choices", [{}])[0].get("message", {}).get("content", "")
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def detect_platform(url):
    if "douyin" in url:
        return "douyin"
    elif "bilibili" in url or "b23.tv" in url:
        return "bilibili"
    elif "xiaohongshu" in url or "xhslink" in url:
        return "xiaohongshu"
    elif "kuaishou" in url:
        return "kuaishou"
    elif "youtube" in url or "youtu.be" in url:
        return "youtube"
    return "unknown"


def extract_video_info(url):
    """使用 Playwright 打开视频页面，提取完整信息"""
    info = {"title": "", "author": "", "description": "", "stats": "", "comments": [], "page_text": ""}

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
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_timeout(5000)

            now = datetime.now().strftime("%Y%m%d_%H%M")
            page.screenshot(path=str(OUTPUT_DIR / f"video_analysis_{now}.png"))

            info["title"] = page.title() or ""

            for selector in ["h1", "[class*='title']", "[class*='Title']"]:
                el = page.query_selector(selector)
                if el:
                    t = el.inner_text().strip()
                    if t and len(t) > 2:
                        info["title"] = t
                        break

            for selector in ["[class*='author']", "[class*='Author']", "[class*='nickname']", "[class*='user-name']"]:
                el = page.query_selector(selector)
                if el:
                    info["author"] = el.inner_text().strip()[:100]
                    break

            for selector in ["[class*='desc']", "[class*='Desc']", "[class*='content']", "p[class*='note']"]:
                el = page.query_selector(selector)
                if el:
                    info["description"] = el.inner_text().strip()[:500]
                    break

            stat_els = page.query_selector_all("[class*='like'], [class*='comment-count'], [class*='share'], [class*='collect'], [class*='play']")
            stats = []
            for el in stat_els[:10]:
                t = el.inner_text().strip()
                if t and len(t) < 50:
                    stats.append(t)
            info["stats"] = " | ".join(stats)

            comment_els = page.query_selector_all("[class*='comment'] [class*='content'], [class*='Comment'] p, [class*='reply-content']")
            for el in comment_els[:30]:
                try:
                    t = el.inner_text().strip()
                    if t and len(t) > 2:
                        info["comments"].append(t[:200])
                except:
                    pass

            page.evaluate("window.scrollTo(0, document.body.scrollHeight / 3)")
            page.wait_for_timeout(2000)

            body = page.query_selector("body")
            if body:
                info["page_text"] = body.inner_text()[:3000]

            browser.close()
    except ImportError:
        info["page_text"] = "[Playwright 未安装，无法解析视频页面]"
    except Exception as e:
        info["page_text"] = f"[页面解析错误: {str(e)[:200]}]"

    return info


def main():
    raw_input = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        p = json.loads(raw_input)
        url = p.get("url", p.get("link", raw_input))
    except:
        url = raw_input

    if not url or not url.startswith("http"):
        print(json.dumps({"ok": False, "error": "请提供视频链接（抖音/B站/小红书/快手/YouTube）"}, ensure_ascii=False))
        return

    now = datetime.now().strftime("%Y%m%d_%H%M")
    platform = detect_platform(url)
    info = extract_video_info(url)

    comments_text = "\n".join([f"- {c}" for c in info["comments"][:20]]) or "（未获取到评论）"

    analysis = call_llm(f"""## 视频内容拆解分析

### 基本信息
- 平台: {platform}
- 链接: {url}
- 标题: {info['title']}
- 作者: {info['author']}
- 数据: {info['stats']}

### 视频描述/文案
{info['description'] or '（未获取到描述）'}

### 评论区 ({len(info['comments'])} 条)
{comments_text}

### 页面内容摘要
{info['page_text'][:1500]}

---

请完成以下分析：

## 1. 内容结构拆解
- 开头钩子（前3秒怎么抓注意力）
- 中间内容（信息密度、节奏、转折）
- 结尾CTA（引导关注/评论/转发的手法）

## 2. 创作手法分析
- 标题技巧（用了什么吸引点击的方法）
- 文案风格（口语化/专业/故事/对比/数据）
- 情绪调动（焦虑/好奇/共鸣/争议/幽默）

## 3. 数据表现解读
- 互动比例分析
- 评论区热度和用户情绪

## 4. 可学习的点
- 5个可直接复用的创作技巧
- 如果我们要做类似内容，具体怎么操作

## 5. 二次创作建议
- 3个基于此视频的衍生选题（标题+角度）
- 适配不同平台的改编方向""")

    result = {
        "ok": True,
        "summary": f"视频拆解: [{platform}] {info['title'][:50]} | 评论 {len(info['comments'])} 条",
        "platform": platform, "url": url, "video_info": {
            "title": info["title"], "author": info["author"],
            "description": info["description"][:300], "stats": info["stats"],
            "comment_count": len(info["comments"]),
        },
        "analysis": analysis,
    }
    (OUTPUT_DIR / f"video_analysis_{now}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
