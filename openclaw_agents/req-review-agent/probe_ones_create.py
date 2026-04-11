"""查 ONES 产品列表，找全棉WMS对应的 product UUID"""
import json, requests, os

cache = json.load(open(os.path.join(os.path.dirname(__file__), "token_cache.json"), encoding="utf-8"))
T = cache["token"]
C = cache["cookie"]
H = {
    "Authorization": f"Bearer {T}", "Cookie": C,
    "Content-Type": "application/json",
    "Referer": "https://ones.winnermedical.com/project/"
}
GRAPHQL = "https://ones.winnermedical.com/project/api/project/team/BSsxXFv2/items/graphql"

q = {"query": "{ products(limit: 50, orderBy: {createTime: ASC}) { uuid name } }"}
r = requests.post(GRAPHQL, headers=H, json=q, timeout=30)
print(f"Status: {r.status_code}")
data = r.json()
for p in data.get("data", {}).get("products", []):
    print(f"  {p['uuid']}  {p['name']}")
