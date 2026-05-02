"""
skill_check_services.py — 赫敏的技能：检查服务状态
检查后端 API、飞书接口、OpenClaw 等关键服务的连通性
"""
import json, os, sys, urllib.request, urllib.error
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from _shared.output import SkillOutput

SERVICES = [
    {"name": "Writeback API", "url": "http://127.0.0.1:18782/health", "method": "GET"},
    {"name": "OpenClaw 引擎", "url": "http://127.0.0.1:18789/health", "method": "GET"},
    {"name": "CLIProxyAPI", "url": "http://127.0.0.1:18800/health", "method": "GET"},
    {"name": "Vite Dev Server", "url": "http://127.0.0.1:5173/", "method": "GET"},
    {"name": "LLM Chat Proxy", "url": "http://127.0.0.1:18782/api/llm/chat", "method": "POST",
     "body": {"model": "cascade", "messages": [{"role": "user", "content": "ping"}], "max_tokens": 5}},
]


def check_service(svc):
    url = svc["url"]
    method = svc.get("method", "GET")
    try:
        if method == "POST" and svc.get("body"):
            data = json.dumps(svc["body"]).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
        else:
            req = urllib.request.Request(url, method="GET")

        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8", errors="ignore")[:200]
            status = resp.status
            return {"name": svc["name"], "url": url, "status": status, "ok": 200 <= status < 400, "detail": body[:100]}
    except urllib.error.HTTPError as e:
        return {"name": svc["name"], "url": url, "status": e.code, "ok": False, "detail": str(e.reason)[:100]}
    except Exception as e:
        return {"name": svc["name"], "url": url, "status": 0, "ok": False, "detail": str(e)[:100]}


def main():
    results = [check_service(svc) for svc in SERVICES]
    online = sum(1 for r in results if r["ok"])
    offline = len(results) - online

    out = SkillOutput()
    out.status = "success" if offline == 0 else "partial"
    out.summary = f"服务状态: {online}/{len(results)} 在线" + (f", {offline} 个服务不可用" if offline else " (全部正常)")
    out.data = {"services": results, "online": online, "offline": offline}
    if offline > 0:
        out.suggest_next("alert_ops", "hermione-tech", {"services": [r["name"] for r in results if not r["ok"]]})
    out.emit()


if __name__ == "__main__":
    main()
