"""
auto_token.py — ONES Bearer Token 自动管理
------------------------------------------
工作原理：
  1. 优先读取 token_cache.json（缓存，有效期内直接复用）
  2. 缓存过期 → 弹出 GUI 小窗，一键打开 ONES + 粘贴 Token
  3. 保存新 Token 到缓存，供本次会话所有调用复用

用法：
  python auto_token.py              → 获取 Token（自动弹窗如需刷新）
  python auto_token.py --json       → 输出 JSON 格式
  python auto_token.py --check      → 仅检查有效性，不弹窗
"""

import os, sys, json, base64, time, webbrowser, subprocess
from datetime import datetime, timezone

# ── 配置 ──────────────────────────────────────────────────
ONES_URL       = "https://ones.winnermedical.com/project/"
ORG_UUID       = "UTcECDmx"
CACHE_FILE     = os.path.join(os.path.dirname(os.path.abspath(__file__)), "token_cache.json")
MIN_VALID_SECS = 300   # 剩余 < 5 分钟视为过期

# ── JWT 解析 ───────────────────────────────────────────────
def decode_jwt_exp(token: str) -> int:
    try:
        parts = token.split(".")
        pad = parts[1] + "=" * (4 - len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(pad))
        return int(payload.get("exp", 0))
    except Exception:
        return 0

def is_token_valid(token: str) -> bool:
    exp = decode_jwt_exp(token)
    return exp > 0 and (exp - int(time.time())) > MIN_VALID_SECS

# ── 缓存读写 ───────────────────────────────────────────────
def load_cache() -> dict | None:
    if not os.path.exists(CACHE_FILE):
        return None
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            info = json.load(f)
        if is_token_valid(info.get("token", "")):
            return info
    except Exception:
        pass
    return None

def save_cache(token: str, cookie: str = ""):
    exp = decode_jwt_exp(token)
    info = {
        "token":       token,
        "cookie":      cookie or f"ones-lang=zh; ones-org-uuid={ORG_UUID}; ones-region-uuid=default",
        "expires_at":  exp,
        "saved_at":    int(time.time()),
        "expires_str": datetime.fromtimestamp(exp, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC") if exp else "unknown"
    }
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    return info

# ── GUI 弹窗获取 Token ─────────────────────────────────────
def ask_token_via_gui() -> str | None:
    """弹出小窗引导用户粘贴 Token，返回 Token 字符串或 None"""
    try:
        import tkinter as tk
        from tkinter import messagebox, scrolledtext

        result = {"token": None}

        root = tk.Tk()
        root.title("ONES Token 刷新")
        root.geometry("520x360")
        root.resizable(False, False)
        root.attributes("-topmost", True)

        # 居中显示
        root.update_idletasks()
        x = (root.winfo_screenwidth() - 520) // 2
        y = (root.winfo_screenheight() - 360) // 2
        root.geometry(f"520x360+{x}+{y}")

        # 标题
        tk.Label(root, text="⚠  ONES Token 已过期，需要刷新", font=("Microsoft YaHei", 12, "bold"),
                 fg="#c0392b").pack(pady=(16, 4))

        # 步骤说明
        steps = (
            "操作步骤（约 20 秒）：\n"
            "① 点击下方按钮，在浏览器中打开 ONES\n"
            "② 按 F12 → Network 标签 → 刷新页面\n"
            "③ 点击任意请求 → 找到 Authorization: Bearer ...\n"
            "④ 复制 Bearer 后面的完整字符串\n"
            "⑤ 粘贴到下方输入框，点击「确认保存」"
        )
        tk.Label(root, text=steps, justify="left", font=("Microsoft YaHei", 9),
                 fg="#2c3e50").pack(padx=20, anchor="w")

        # 打开浏览器按钮
        def open_ones():
            webbrowser.open(ONES_URL)

        tk.Button(root, text="① 打开 ONES", command=open_ones,
                  bg="#2980b9", fg="white", font=("Microsoft YaHei", 10),
                  width=16, height=1).pack(pady=(10, 4))

        # Token 输入框
        tk.Label(root, text="④ 粘贴 Bearer Token：", font=("Microsoft YaHei", 9), anchor="w").pack(padx=20, anchor="w")
        text_box = scrolledtext.ScrolledText(root, height=4, wrap=tk.WORD,
                                              font=("Courier New", 8))
        text_box.pack(padx=20, fill="x")

        # 确认按钮
        def confirm():
            raw = text_box.get("1.0", tk.END).strip()
            # 去掉可能的 "Bearer " 前缀
            if raw.lower().startswith("bearer "):
                raw = raw[7:].strip()
            if not raw or len(raw) < 50:
                messagebox.showwarning("输入错误", "请粘贴完整的 Token（很长的字符串）")
                return
            if not is_token_valid(raw):
                exp = decode_jwt_exp(raw)
                remaining = exp - int(time.time()) if exp else -1
                if remaining < 0:
                    messagebox.showwarning("Token 已过期", f"此 Token 已过期，请重新从浏览器复制最新的 Token")
                    return
            result["token"] = raw
            root.destroy()

        tk.Button(root, text="确认保存 ✓", command=confirm,
                  bg="#27ae60", fg="white", font=("Microsoft YaHei", 10, "bold"),
                  width=16, height=1).pack(pady=8)

        root.mainloop()
        return result["token"]

    except ImportError:
        # tkinter 不可用时，回退到命令行
        print("\n" + "="*60)
        print("ONES Token 已过期，请刷新：")
        print("1. 打开浏览器访问:", ONES_URL)
        print("2. 按 F12 → Network → 刷新页面")
        print("3. 复制任意请求的 Authorization: Bearer <token>")
        print("="*60)
        token = input("粘贴 Token（直接回车取消）: ").strip()
        if token.lower().startswith("bearer "):
            token = token[7:].strip()
        return token if token else None

# ── 主逻辑 ─────────────────────────────────────────────────
def get_token(silent: bool = False) -> dict:
    """
    返回 {"token": str, "cookie": str, "expires_at": int, ...}
    silent=True 时不弹窗，直接报错
    """
    # 1. 先查缓存
    cached = load_cache()
    if cached:
        remaining = cached["expires_at"] - int(time.time())
        cached["remaining"] = remaining
        cached["from_cache"] = True
        return cached

    if silent:
        raise RuntimeError("Token 已过期且 silent=True，无法自动刷新")

    # 2. 弹窗获取
    token = ask_token_via_gui()
    if not token:
        raise RuntimeError("用户取消了 Token 输入")

    cookie = f"ones-lang=zh; ones-org-uuid={ORG_UUID}; ones-region-uuid=default"
    info = save_cache(token, cookie)
    info["remaining"] = info["expires_at"] - int(time.time())
    info["from_cache"] = False
    return info

# ── CLI ────────────────────────────────────────────────────
if __name__ == "__main__":
    args = sys.argv[1:]

    if "--check" in args:
        cached = load_cache()
        if cached:
            rem = cached["expires_at"] - int(time.time())
            print(f"[有效] Token 剩余 {rem//60} 分 {rem%60} 秒（到期 {cached.get('expires_str','')}）")
            sys.exit(0)
        else:
            print("[过期] 缓存中无有效 Token")
            sys.exit(1)

    if "--save" in args:
        # 从命令行参数直接保存 token（无需弹窗）
        # 用法：python auto_token.py --save <token>
        idx = args.index("--save")
        if idx + 1 < len(args):
            token = args[idx + 1]
            if token.lower().startswith("bearer "):
                token = token[7:].strip()
            info = save_cache(token)
            print(f"[OK] Token 已保存，有效至 {info['expires_str']}")
            sys.exit(0)

    try:
        info = get_token()
        remaining = info.get("remaining", 0)
        src = "缓存" if info.get("from_cache") else "新获取"
        if "--json" in args:
            print(json.dumps({k: v for k, v in info.items() if k != "token"}, ensure_ascii=False, indent=2))
            print(f'\n"token": "{info["token"][:40]}..."')
        else:
            print(f"[OK/{src}] 剩余 {remaining//60} 分 {remaining%60} 秒  到期 {info.get('expires_str','')}")
            print(info["token"])
    except RuntimeError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)
