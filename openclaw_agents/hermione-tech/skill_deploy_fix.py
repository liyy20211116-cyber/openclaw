"""
skill_deploy_fix.py — 赫敏的技能：诊断并修复常见部署问题
检查配置文件、依赖、端口占用、日志错误
"""
import json, os, sys, socket, importlib

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(os.path.dirname(HERE))

fixes = []
checks = []

def check(name, ok, detail="", fix=""):
    checks.append({"check": name, "ok": ok, "detail": detail})
    if not ok and fix:
        fixes.append(fix)

# Python 依赖
for mod in ["requests", "playwright"]:
    try:
        importlib.import_module(mod)
        check(f"Python 模块 {mod}", True, "已安装")
    except ImportError:
        check(f"Python 模块 {mod}", False, "未安装", f"pip install {mod}")

# 关键配置文件
req_agent = os.path.join(PROJECT, "openclaw_agents", "req-review-agent")
config_path = os.path.join(req_agent, "config.json")
if os.path.exists(config_path):
    try:
        cfg = json.loads(open(config_path, encoding="utf-8").read())
        required_sections = ["feishu", "ones", "reviewer_open_id"]
        missing = [s for s in required_sections if s not in cfg]
        check("config.json 完整性", not missing, f"缺少: {missing}" if missing else "完整", "检查 config.json 中的必要字段" if missing else "")
    except Exception as e:
        check("config.json 可读", False, str(e), "检查 JSON 格式")
else:
    check("config.json 存在", False, "文件不存在", "从 config.example.json 复制并填写配置")

# Token 有效性
token_path = os.path.join(req_agent, "token_cache.json")
if os.path.exists(token_path):
    try:
        cache = json.loads(open(token_path, encoding="utf-8").read())
        lt = cache.get("ones_lt", "")
        if lt:
            import base64
            parts = lt.split(".")
            if len(parts) == 3:
                payload = json.loads(base64.b64decode(parts[1] + "==").decode("utf-8", errors="ignore"))
                import time
                exp = payload.get("exp", 0)
                if exp * 1000 > time.time() * 1000:
                    check("ONES Token", True, f"有效，{int((exp - time.time()) / 60)} 分钟后过期")
                else:
                    check("ONES Token", False, "已过期", "运行 ones_token_refresh.py 刷新")
        else:
            check("ONES Token", False, "token_cache.json 中无 ones_lt", "运行 capture_ones_token.py")
    except Exception as e:
        check("ONES Token 检查", False, str(e))
else:
    check("token_cache.json", False, "不存在", "运行 capture_ones_token.py 获取初始 Token")

# 端口占用
for port, name in [(18782, "Jarvis 后端"), (5173, "Vite 前端"), (18789, "OpenClaw Gateway")]:
    try:
        s = socket.create_connection(("127.0.0.1", port), timeout=3)
        s.close()
        check(f"{name} (:{port})", True, "运行中")
    except:
        check(f"{name} (:{port})", False, "未启动", f"启动 {name} 服务")

# 卡片模板
tpl_dir = os.path.join(req_agent, "templates")
if os.path.isdir(tpl_dir):
    tpls = [f for f in os.listdir(tpl_dir) if f.endswith(".json")]
    check("卡片模板", len(tpls) > 0, f"{len(tpls)} 个模板")
else:
    check("卡片模板", False, "templates 目录不存在", "创建 templates 目录并添加卡片模板")

ok_count = sum(1 for c in checks if c["ok"])
total = len(checks)

summary = f"部署诊断: {ok_count}/{total} 通过"
if fixes:
    summary += f" | 修复建议: {'; '.join(fixes[:3])}"

print(json.dumps({"ok": len(fixes) == 0, "summary": summary, "checks": checks, "fixes": fixes}, ensure_ascii=False))
