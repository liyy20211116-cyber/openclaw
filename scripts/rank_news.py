import json, os
from datetime import datetime

ROOT = r"D:\FY003"
d = datetime.now().strftime("%Y%m%d")
raw = os.path.join(ROOT, "data_raw", f"news_{d}.json")
data = json.load(open(raw, encoding="utf-8")).get("items", [])
top = data[:8]

out = os.path.join(ROOT, "data_clean", f"top_news_{d}.json")
json.dump({"items": top}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(out)
