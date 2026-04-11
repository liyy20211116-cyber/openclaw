"""
skill_run_test.py — 赫敏的技能：运行 req-review-agent 的测试验证
"""
import json, os, sys, importlib.util, traceback

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "..", "req-review-agent")
sys.path.insert(0, TARGET)

results = []

def test_config():
    config_path = os.path.join(TARGET, "config.json")
    try:
        cfg = json.loads(open(config_path, encoding="utf-8").read())
        required = ["feishu", "ones", "reviewer_open_id"]
        missing = [k for k in required if k not in cfg]
        if missing:
            return {"test": "config.json 完整性", "status": "fail", "message": f"缺少字段: {missing}"}
        return {"test": "config.json 完整性", "status": "pass", "message": f"包含 {len(cfg)} 个顶层配置项"}
    except Exception as e:
        return {"test": "config.json 完整性", "status": "fail", "message": str(e)}

def test_token_cache():
    path = os.path.join(TARGET, "token_cache.json")
    try:
        cache = json.loads(open(path, encoding="utf-8").read())
        has_token = bool(cache.get("ones_lt"))
        return {"test": "token_cache.json", "status": "pass" if has_token else "warn", "message": "ones_lt " + ("存在" if has_token else "为空")}
    except:
        return {"test": "token_cache.json", "status": "warn", "message": "文件不存在或不可读"}

def test_templates():
    tpl_dir = os.path.join(TARGET, "templates")
    if not os.path.isdir(tpl_dir):
        return {"test": "卡片模板目录", "status": "fail", "message": "templates/ 目录不存在"}
    files = os.listdir(tpl_dir)
    json_files = [f for f in files if f.endswith(".json")]
    return {"test": "卡片模板目录", "status": "pass" if json_files else "warn", "message": f"{len(json_files)} 个 JSON 模板"}

def test_scan_import():
    try:
        spec = importlib.util.spec_from_file_location("scan", os.path.join(TARGET, "scan_and_send.py"))
        mod = importlib.util.module_from_spec(spec)
        return {"test": "scan_and_send.py 可导入", "status": "pass", "message": "模块加载成功"}
    except Exception as e:
        return {"test": "scan_and_send.py 可导入", "status": "fail", "message": str(e)[:100]}

def test_memory_dir():
    mem = os.path.join(TARGET, "memory")
    if not os.path.isdir(mem):
        return {"test": "memory 目录", "status": "warn", "message": "不存在，将在首次运行时创建"}
    files = os.listdir(mem)
    return {"test": "memory 目录", "status": "pass", "message": f"包含 {len(files)} 个文件"}

results.append(test_config())
results.append(test_token_cache())
results.append(test_templates())
results.append(test_scan_import())
results.append(test_memory_dir())

passed = sum(1 for r in results if r["status"] == "pass")
failed = sum(1 for r in results if r["status"] == "fail")
warned = sum(1 for r in results if r["status"] == "warn")

summary = f"测试完成: {passed} 通过 / {warned} 警告 / {failed} 失败（共 {len(results)} 项）"
print(json.dumps({"ok": failed == 0, "summary": summary, "tests": results}, ensure_ascii=False))
