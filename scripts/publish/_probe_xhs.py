"""临时探测小红书发布页 DOM 结构。"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _common import connect_cdp

pw, br, ctx, _ = connect_cdp(9222)
try:
    for p in ctx.pages:
        if "xiaohongshu.com" in (p.url or "") and "/publish" in (p.url or ""):
            p.bring_to_front()
            p.wait_for_timeout(2500)
            info = p.evaluate("""
                () => {
                    const frames = [...document.querySelectorAll('iframe')].map(f => ({src: f.src || '', name: f.name || ''}));
                    const inputs = [...document.querySelectorAll('input[type=file]')].map(i => ({
                        visible: i.offsetParent !== null,
                        accept: i.accept || '',
                        class: i.className || '',
                        id: i.id || '',
                    }));
                    const tabs = [...document.querySelectorAll('[class*=tab], [class*=Tab], .el-tab, [role=tab]')].slice(0, 15).map(t => (t.textContent || '').trim().slice(0, 30));
                    const buttons = [...document.querySelectorAll('button, [role=button], .btn')].slice(0, 20).map(b => (b.textContent || '').trim().slice(0, 30)).filter(x => x);
                    return {url: location.href, title: document.title, frames, inputs, tabs, buttons};
                }
            """)
            print("URL:", info["url"])
            print("TITLE:", info["title"])
            print("\nFRAMES:")
            for f in info["frames"]:
                print(f"  - {f}")
            print("\nINPUTS[type=file]:")
            for i in info["inputs"]:
                print(f"  - {i}")
            print("\nTABS (top 15):")
            for t in info["tabs"]:
                print(f"  - {t}")
            print("\nBUTTONS (top 20):")
            for b in info["buttons"]:
                print(f"  - {b}")
            break
finally:
    try:
        pw.stop()
    except Exception:
        pass
