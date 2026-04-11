"""
create_ones_issue.py — 在 ONES 创建问题缺陷并返回 issue UUID
"""
import sys, json, requests

TOKEN  = sys.argv[1] if len(sys.argv) > 1 else ""
COOKIE = sys.argv[2] if len(sys.argv) > 2 else ""

H = {
    "Authorization": f"Bearer {TOKEN}",
    "Cookie":        COOKIE,
    "Content-Type":  "application/json",
    "Referer":       "https://ones.winnermedical.com/project/"
}
BASE = "https://ones.winnermedical.com/project/api/project/team/BSsxXFv2"
GRAPHQL = f"{BASE}/items/graphql"

# ── 先尝试 GraphQL mutation ──────────────────────────────
mutation = {
    "query": """
mutation {
  addTask(
    project_uuid: "QE2GXyz1K1Z1aDui"
    issue_type_uuid: "TNVWjjtZ"
    summary: "tob -退货装箱加工报表 修改"
  ) {
    key
    uuid
    summary
  }
}
"""
}

r = requests.post(GRAPHQL, headers=H, json=mutation, timeout=30)
print(f"[GraphQL mutation] {r.status_code}")
print(r.text[:1000])
print()

# ── 再尝试 REST POST /task (不含 project_uuid) ───────────
rest_body = {
    "project_uuid":    "QE2GXyz1K1Z1aDui",
    "issue_type_uuid": "TNVWjjtZ",
    "summary":         "tob -退货装箱加工报表 修改",
    "field_values": [
        {"field_uuid": "field038", "value": "Gjh8TNF3"}
    ]
}
for path in ["/task", "/tasks", "/project/QE2GXyz1K1Z1aDui/task", "/project/QE2GXyz1K1Z1aDui/tasks"]:
    url = BASE + path
    r2 = requests.post(url, headers=H, json=rest_body, timeout=10)
    print(f"[POST {path}] {r2.status_code} {r2.text[:200]}")
