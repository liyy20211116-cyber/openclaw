"""
skill_check_services.py — 赫敏的技能：检查所有服务连通性
输出 JSON 格式的诊断结果
"""
import json, sys, os, socket, urllib.request, urllib.error

results = {}

def check_port(host, port, label):
    try:
        s = socket.create_connection((host, port), timeout=5)
        s.close()
        results[label] = {"status": "ok", "message": f"{host}:{port} 可达"}
    except Exception as e:
        results[label] = {"status": "error", "message": f"{host}:{port} 不可达 - {e}"}

def check_http(url, label):
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            results[label] = {"status": "ok", "message": f"HTTP {resp.status}"}
    except urllib.error.HTTPError as e:
        results[label] = {"status": "warning", "message": f"HTTP {e.code}"}
    except Exception as e:
        results[label] = {"status": "error", "message": str(e)}

check_port("127.0.0.1", 18782, "jarvis_backend")
check_port("127.0.0.1", 5173, "jarvis_frontend")
check_port("127.0.0.1", 18789, "openclaw_gateway")

check_http("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", "feishu_api")
check_http("https://ones.winnermedical.com/project/", "ones_portal")

HERE = os.path.dirname(os.path.abspath(__file__))
req_agent = os.path.join(HERE, "..", "req-review-agent")
config_ok = os.path.exists(os.path.join(req_agent, "config.json"))
token_ok = os.path.exists(os.path.join(req_agent, "token_cache.json"))
results["req_agent_config"] = {"status": "ok" if config_ok else "error", "message": "config.json " + ("存在" if config_ok else "缺失")}
results["req_agent_token"] = {"status": "ok" if token_ok else "warning", "message": "token_cache.json " + ("存在" if token_ok else "缺失")}

pipeline_api = False
try:
    s = socket.create_connection(("127.0.0.1", 18781), timeout=3)
    s.close()
    pipeline_api = True
except:
    pass
results["content_pipeline"] = {"status": "ok" if pipeline_api else "warning", "message": "内容流水线 " + ("运行中" if pipeline_api else "未启动")}

ok_count = sum(1 for v in results.values() if v["status"] == "ok")
warn_count = sum(1 for v in results.values() if v["status"] == "warning")
err_count = sum(1 for v in results.values() if v["status"] == "error")

summary = f"服务诊断完成: {ok_count} 正常 / {warn_count} 警告 / {err_count} 异常"
print(json.dumps({"ok": err_count == 0, "summary": summary, "details": results}, ensure_ascii=False))
