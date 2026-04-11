import json, os
from datetime import datetime

ROOT = r"D:\FY003"
d = datetime.now().strftime("%Y%m%d")
inp = os.path.join(ROOT, "data_clean", f"top_news_{d}.json")
items = json.load(open(inp, encoding="utf-8")).get("items", [])

lines = [f"Daily Finance Brief {d}", "", "Top headlines:", ""]
for i, x in enumerate(items[:5], 1):
    title = x.get("title", "")
    lines.append(f"{i}. {title}")

out = os.path.join(ROOT, "output", f"script_today_{d}.txt")
open(out, "w", encoding="utf-8").write("\n".join(lines))
print(out)
