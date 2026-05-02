"""
skill_code_review.py — 赫敏的技能：代码审查
扫描指定目录/文件的代码质量、错误处理、安全隐患，调用 LLM 输出审查报告
"""
import json, os, sys, re, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
BACKEND_URL = "http://127.0.0.1:18782/api/llm/chat"

task_arg = sys.argv[1] if len(sys.argv) > 1 else ""


def call_llm(prompt, max_tokens=1500):
    body = json.dumps({
        "model": "cascade",
        "messages": [
            {"role": "system", "content": "你是赫敏·格兰杰，一人公司 CTO。你正在做代码审查，请直接指出问题和改进建议，不要寒暄。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": max_tokens,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[LLM 调用失败: {e}]"


def scan_code_files(target_dir):
    issues = []
    file_stats = []
    for root, _dirs, files in os.walk(target_dir):
        for fname in sorted(files):
            if not fname.endswith((".py", ".ts", ".tsx", ".js")):
                continue
            fpath = os.path.join(root, fname)
            rel = os.path.relpath(fpath, PROJECT_ROOT)
            try:
                code = open(fpath, encoding="utf-8", errors="ignore").read()
                lines = len(code.split("\n"))
                bare_except = len(re.findall(r"^\s*except\s*:", code, re.M))
                todo_count = len(re.findall(r"#\s*TODO|//\s*TODO", code, re.I))
                hardcoded_secrets = len(re.findall(r"(password|secret|api_key|token)\s*=\s*['\"](?!$)", code, re.I))
                no_timeout = len(re.findall(r"(fetch|requests\.\w+|urlopen)\([^)]*\)(?!.*timeout)", code))

                if bare_except > 0:
                    issues.append(f"{rel}: {bare_except} 个裸 except")
                if hardcoded_secrets > 0:
                    issues.append(f"{rel}: 疑似硬编码密钥 {hardcoded_secrets} 处")
                if no_timeout > 0:
                    issues.append(f"{rel}: {no_timeout} 个网络请求缺少 timeout")

                file_stats.append({"file": rel, "lines": lines, "bare_except": bare_except, "todos": todo_count})
            except Exception:
                pass
    return file_stats, issues


def main():
    target = task_arg or os.path.join(PROJECT_ROOT, "jarvis-one-company-os", "scripts")
    if not os.path.isdir(target):
        target = os.path.join(PROJECT_ROOT, "jarvis-one-company-os", "src")

    file_stats, issues = scan_code_files(target)
    total_files = len(file_stats)
    total_lines = sum(f["lines"] for f in file_stats)

    stats_text = "\n".join([f"- {f['file']} ({f['lines']}行) 裸except:{f['bare_except']} TODO:{f['todos']}" for f in file_stats[:20]])
    issues_text = "\n".join([f"- {i}" for i in issues[:15]]) or "未发现明显问题"

    prompt = f"""## 代码审查: {os.path.basename(target)}
扫描 {total_files} 个文件，共 {total_lines} 行

## 文件概览
{stats_text}

## 自动检测问题
{issues_text}

请完成：
1. 代码质量评分（1-10）及理由
2. Top 5 关键问题（按严重程度排序）
3. 安全隐患清单
4. 改进建议（按优先级）"""

    analysis = call_llm(prompt)
    result = {
        "ok": True,
        "summary": f"代码审查完成: {total_files} 个文件, {total_lines} 行, 发现 {len(issues)} 个自动检测问题",
        "analysis": analysis,
        "auto_issues": issues[:15],
        "stats": {"total_files": total_files, "total_lines": total_lines},
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
