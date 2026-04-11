"""
skill_content_pipeline.py — 卢娜的技能：驱动内容生产流水线
调用 pipeline_api (127.0.0.1:18781) 执行 fetch→rank→script→video
"""
import json, sys, time, urllib.request, urllib.error

API = "http://127.0.0.1:18781"

def api_call(method, path, body=None):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method,
                                headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())

try:
    api_call("GET", "/health")
except Exception as e:
    print(json.dumps({
        "ok": False,
        "summary": "内容流水线服务未启动",
        "message": f"无法连接 {API}/health: {e}\n请运行 scripts\\start_pipeline_api.bat 启动服务"
    }, ensure_ascii=False))
    sys.exit(0)

step = sys.argv[1] if len(sys.argv) > 1 else "daily"

try:
    start_resp = api_call("POST", "/run", {"step": step})
    print(json.dumps({"phase": "started", "step": step, "response": start_resp}, ensure_ascii=False), file=sys.stderr)
except Exception as e:
    print(json.dumps({"ok": False, "summary": f"启动失败: {e}"}, ensure_ascii=False))
    sys.exit(0)

wait_map = {"all": 70, "daily": 20, "video": 50, "fetch": 10, "rank": 3, "script": 5}
time.sleep(wait_map.get(step, 20))

for attempt in range(5):
    try:
        status = api_call("GET", "/status")
        if status.get("status") == "done":
            outputs = status.get("outputs", {})
            summary_parts = [f"流水线 [{step}] 完成，耗时 {status.get('elapsed_sec', '?')}s"]
            if outputs.get("script_content"):
                summary_parts.append(f"脚本: {len(outputs['script_content'])} 字")
            if outputs.get("video_path"):
                summary_parts.append(f"视频: {outputs.get('video_size_kb', '?')}KB")
            print(json.dumps({
                "ok": True,
                "summary": " | ".join(summary_parts),
                "outputs": outputs,
            }, ensure_ascii=False))
            sys.exit(0)
        elif status.get("status") == "error":
            print(json.dumps({
                "ok": False,
                "summary": f"流水线执行出错: {status.get('stderr', '未知错误')[:300]}",
            }, ensure_ascii=False))
            sys.exit(0)
    except:
        pass
    time.sleep(15)

print(json.dumps({
    "ok": False,
    "summary": f"流水线 [{step}] 超时，可能仍在运行。稍后查询 GET {API}/status 获取结果"
}, ensure_ascii=False))
