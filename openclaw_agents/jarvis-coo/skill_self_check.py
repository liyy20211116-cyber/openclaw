"""
贾维斯能力自检 — 实际验证所有核心工具是否可用
用法: python skill_self_check.py
"""
import os, sys, json, socket, subprocess, importlib
from pathlib import Path
from datetime import datetime

HERE = Path(__file__).parent
ROOT = HERE.parent.parent

def check_item(name, func):
    try:
        result = func()
        print(f"  [OK] {name}: {result}")
        return True
    except Exception as e:
        print(f"  [FAIL] {name}: {e}")
        return False

def main():
    print(f"=== 贾维斯能力自检 === {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Python: {sys.version.split()[0]}")
    print(f"CWD: {os.getcwd()}")
    print()

    passed = 0
    total = 0

    print("[1/6] 网络连通性")
    total += 1
    if check_item("DNS 解析", lambda: socket.getaddrinfo("open.feishu.cn", 443)[0][4]):
        passed += 1
    total += 1
    if check_item("HTTPS 连接", lambda: __import__("requests").get("https://open.feishu.cn", timeout=10).status_code):
        passed += 1

    print("\n[2/6] Python 关键库")
    libs = ["requests", "playwright", "pandas", "lark_oapi", "Crypto"]
    for lib in libs:
        total += 1
        if check_item(f"import {lib}", lambda l=lib: importlib.import_module(l).__name__):
            passed += 1

    print("\n[3/6] 本地工具")
    tools = [
        ("Node.js", "node --version"),
        ("Git", "git --version"),
        ("curl", "curl --version"),
    ]
    for name, cmd in tools:
        total += 1
        if check_item(name, lambda c=cmd: subprocess.run(c.split(), capture_output=True, timeout=10, text=True).stdout.strip().split("\n")[0]):
            passed += 1

    print("\n[4/6] 文件系统")
    total += 1
    if check_item("读取配置", lambda: "OK" if (HERE / "IDENTITY.md").exists() else "MISSING"):
        passed += 1
    total += 1
    test_file = ROOT / "output" / "temp" / "_self_check_test.txt"
    if check_item("写入测试", lambda: (test_file.parent.mkdir(parents=True, exist_ok=True), test_file.write_text("test", encoding="utf-8"), test_file.unlink(), "OK")[-1]):
        passed += 1

    print("\n[5/6] 飞书 API")
    total += 1
    config_path = ROOT / "openclaw_agents" / "req-review-agent" / "config.json"
    try:
        cfg = json.loads(config_path.read_text(encoding="utf-8"))
        import requests
        r = requests.post(
            "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
            json={"app_id": cfg["feishu_app_id"], "app_secret": cfg["feishu_app_secret"]},
            timeout=10
        )
        token = r.json().get("tenant_access_token", "")
        if token:
            print(f"  [OK] 飞书 Token: {token[:20]}...")
            passed += 1
        else:
            print(f"  [FAIL] 飞书 Token: {r.json()}")
    except Exception as e:
        print(f"  [FAIL] 飞书 API: {e}")

    print("\n[6/6] OpenClaw Gateway")
    total += 1
    try:
        import requests
        r = requests.get("http://127.0.0.1:18789/gateway/", timeout=5)
        if check_item("Gateway UI", lambda: f"HTTP {r.status_code}"):
            passed += 1
    except Exception as e:
        print(f"  [FAIL] Gateway: {e}")

    print(f"\n{'='*40}")
    print(f"结果: {passed}/{total} 通过 ({'%.0f' % (passed/total*100)}%)")
    status = "全部就绪" if passed == total else "部分异常" if passed > total * 0.7 else "严重缺失"
    print(f"状态: {status}")

    result = {
        "timestamp": datetime.now().isoformat(),
        "passed": passed,
        "total": total,
        "status": status
    }
    result_path = HERE / "memory" / "last_self_check.json"
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"结果已保存: {result_path}")

if __name__ == "__main__":
    main()
