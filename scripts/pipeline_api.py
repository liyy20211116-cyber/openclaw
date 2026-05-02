#!/usr/bin/env python3
"""
Content Pipeline API Server — Port 18781
为 OpenClaw Agent 提供 HTTP 接口，封装 D:\FY003 内容生产流水线。

端点：
  GET  /health          健康检查
  GET  /status          当前/最近一次任务状态
  POST /run             启动任务，body: {"step": "all|daily|video|fetch|rank|script"}
"""

import json
import os
import subprocess
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = "D:\\FY003"
PORT = 18781

_lock = threading.Lock()
_job: dict = {
    "status": "idle",       # idle | running | done | error
    "step": None,
    "started_at": None,
    "finished_at": None,
    "elapsed_sec": None,
    "stdout": "",
    "stderr": "",
    "outputs": {},
}


# ─── helpers ────────────────────────────────────────────────────────────────

def _collect_outputs() -> dict:
    """读取今日产出文件信息。"""
    today = datetime.now().strftime("%Y%m%d")
    out: dict = {}

    script_path = os.path.join(ROOT, "output", f"script_today_{today}.txt")
    if os.path.exists(script_path):
        out["script_path"] = script_path
        try:
            out["script_content"] = open(script_path, encoding="utf-8").read()
        except Exception:
            pass

    bundle_dir = os.path.join(ROOT, "output", f"publish_bundle_{today}")
    video_path = os.path.join(bundle_dir, f"finance_brief_{today}.mp4")
    if os.path.exists(video_path):
        out["video_path"] = video_path
        out["video_size_kb"] = round(os.path.getsize(video_path) / 1024)

    return out


def _cmd_for_step(step: str):
    ps_dir = os.path.join(ROOT, "scripts")
    py_run = ["py", "-3"]
    ps_run = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File"]
    mapping = {
        "fetch":  py_run  + [os.path.join(ps_dir, "fetch_news.py")],
        "rank":   py_run  + [os.path.join(ps_dir, "rank_news.py")],
        "script": py_run  + [os.path.join(ps_dir, "write_script.py")],
        "daily":  ps_run  + [os.path.join(ps_dir, "run_daily.ps1")],
        "video":  ps_run  + [os.path.join(ps_dir, "build_video.ps1")],
    }
    if step == "all":
        return [mapping["daily"], mapping["video"]]
    return [mapping[step]]


def _worker(step: str):
    """在后台线程执行流水线步骤，完成后更新 _job。"""
    t0 = datetime.now()
    try:
        cmds = _cmd_for_step(step)
        stdout_parts, stderr_parts = [], []
        rc = 0
        for cmd in cmds:
            r = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180,
                cwd=ROOT,
            )
            if r.stdout.strip():
                stdout_parts.append(r.stdout.strip())
            if r.stderr.strip():
                stderr_parts.append(r.stderr.strip())
            rc = r.returncode
            if rc != 0:
                break

        elapsed = round((datetime.now() - t0).total_seconds(), 1)
        with _lock:
            _job.update({
                "status":       "done" if rc == 0 else "error",
                "finished_at":  datetime.now().isoformat(),
                "elapsed_sec":  elapsed,
                "stdout":       "\n".join(stdout_parts),
                "stderr":       "\n".join(stderr_parts),
                "outputs":      _collect_outputs(),
            })

    except subprocess.TimeoutExpired:
        with _lock:
            _job.update({
                "status":      "error",
                "finished_at": datetime.now().isoformat(),
                "elapsed_sec": round((datetime.now() - t0).total_seconds(), 1),
                "stderr":      "Timeout: step exceeded 180s",
            })
    except Exception as exc:
        with _lock:
            _job.update({
                "status":      "error",
                "finished_at": datetime.now().isoformat(),
                "elapsed_sec": round((datetime.now() - t0).total_seconds(), 1),
                "stderr":      str(exc),
            })


# ─── HTTP handler ────────────────────────────────────────────────────────────

VALID_STEPS = {"all", "daily", "video", "fetch", "rank", "script"}


class PipelineHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] {self.address_string()} {fmt % args}")

    def _send_json(self, data: dict, status: int = 200):
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/health":
            self._send_json({"ok": True, "port": PORT, "root": ROOT})

        elif path == "/status":
            with _lock:
                self._send_json(dict(_job))

        else:
            self._send_json({"error": "Not found"}, 404)

    def do_POST(self):
        path = urlparse(self.path).path

        if path != "/run":
            return self._send_json({"error": "Not found"}, 404)

        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            body = json.loads(raw)
        except Exception:
            return self._send_json({"error": "Invalid JSON"}, 400)

        step = body.get("step", "all")
        if step not in VALID_STEPS:
            return self._send_json(
                {"error": f"Unknown step '{step}'. Valid: {sorted(VALID_STEPS)}"}, 400
            )

        with _lock:
            if _job["status"] == "running":
                return self._send_json(
                    {"error": "A job is already running", "current_step": _job["step"]}, 409
                )
            _job.update({
                "status":      "running",
                "step":        step,
                "started_at":  datetime.now().isoformat(),
                "finished_at": None,
                "elapsed_sec": None,
                "stdout":      "",
                "stderr":      "",
                "outputs":     {},
            })

        threading.Thread(target=_worker, args=(step,), daemon=True).start()

        with _lock:
            self._send_json(dict(_job))


# ─── main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), PipelineHandler)
    print(f"[PipelineAPI] Listening on http://127.0.0.1:{PORT}")
    print(f"[PipelineAPI] ROOT = {ROOT}")
    print(f"[PipelineAPI] Valid steps: {sorted(VALID_STEPS)}")
    print("[PipelineAPI] Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[PipelineAPI] Stopped.")
