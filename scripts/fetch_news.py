import json, os, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime

ROOT = r"D:\FY003"
urls = [
    "https://feeds.bbci.co.uk/news/business/rss.xml",
    "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best"
 ]

items = []
for u in urls:
    try:
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
        txt = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "ignore")
        r = ET.fromstring(txt)
        for it in r.findall(".//item"):
            t = (it.findtext("title") or "").strip()
            l = (it.findtext("link") or "").strip()
            if t:
                items.append({"title": t, "link": l, "source": u})
    except Exception:
        pass

d = datetime.now().strftime("%Y%m%d")
out = os.path.join(ROOT, "data_raw", f"news_{d}.json")
json.dump({"items": items}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(out)
