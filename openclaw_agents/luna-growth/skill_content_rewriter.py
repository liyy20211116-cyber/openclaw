"""
skill_content_rewriter.py — 卢娜的技能：内容二创/跨平台改写
输入原始内容 → 输出多平台适配版本（小红书笔记/抖音脚本/公众号/朋友圈/微博）
"""
import json, sys
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
            {"role": "system", "content": "你是卢娜，一人公司增长官。你精通各平台的内容风格和算法偏好，能将同一内容改编为不同平台的最优版本。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.6, "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read().decode("utf-8")).get("choices", [{}])[0].get("message", {}).get("content", "")
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def main():
    raw_input = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        params = json.loads(raw_input)
        content = params.get("content", "")
        source_platform = params.get("source", "通用")
        target_platforms = params.get("targets", ["小红书", "抖音", "公众号", "朋友圈"])
    except:
        content = raw_input
        source_platform = "通用"
        target_platforms = ["小红书", "抖音", "公众号", "朋友圈"]

    if not content:
        print(json.dumps({"ok": False, "error": "请提供原始内容。参数: {\"content\": \"...\", \"source\": \"抖音\", \"targets\": [\"小红书\", \"公众号\"]}"}, ensure_ascii=False))
        return

    now = datetime.now().strftime("%Y%m%d_%H%M")
    platforms_str = "、".join(target_platforms)

    result_text = call_llm(f"""## 内容跨平台改写

### 原始内容（来源: {source_platform}）
{content[:2000]}

---

请将上述内容改写为以下平台的版本: {platforms_str}

每个平台都需要输出：

### 小红书版本（如在目标中）
- 标题（含表情符号，15-20字）
- 正文（分段落，口语化，加表情，1000字以内）
- 标签（5-8个 #话题）
- 封面建议

### 抖音版本（如在目标中）
- 视频标题（吸引点击，20字以内）
- 开头钩子（前3秒的话术）
- 正文脚本（口播文案，控制在60秒内，约200字）
- 结尾CTA
- BGM风格建议
- 字幕关键词

### 公众号版本（如在目标中）
- 标题（数字/悬念/对比，25字以内）
- 导语（开头段，引发阅读兴趣）
- 正文（分小标题，800-1500字）
- 结尾互动引导

### 朋友圈版本（如在目标中）
- 文案（3-5行，附表情）
- 配图建议（几张/什么类型）

### 微博版本（如在目标中）
- 文案（140字以内，含话题标签）
- 配图/视频建议

对每个版本，请标注关键的平台算法偏好提示（比如小红书偏好互动引导、抖音偏好完播率优化等）。""")

    result = {
        "ok": True,
        "summary": f"内容二创完成: 从「{source_platform}」改写为 {len(target_platforms)} 个平台版本",
        "source_platform": source_platform,
        "target_platforms": target_platforms,
        "original_length": len(content),
        "rewritten_content": result_text,
    }
    (OUTPUT_DIR / f"content_rewrite_{now}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
