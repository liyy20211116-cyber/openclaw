import json, requests

cfg = json.load(open("config.json", encoding="utf-8"))
f = cfg["feishu"]

r = requests.post("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    json={"app_id": "cli_a8e665e113a4500e", "app_secret": "fFqJuhmuJZBOFxPvBSQ8RhouaPpg4I0k"}, timeout=10)
token = r.json()["tenant_access_token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

app_token = f["bitable_app_token"]
table_id  = f["table_id"]
record_id = "recvdUU4Y3kOcs"
url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/{record_id}"

body = {"fields": {f["fields"]["status"]: f["status_values"]["rejected"]}}
print("URL:", url)
print("body:", body)

# 试 PATCH
rp = requests.patch(url, headers=headers, json=body, timeout=15)
print("\nPATCH HTTP:", rp.status_code)
print("PATCH body:", rp.content.decode("utf-8", errors="replace").strip()[:200])

# 试 PUT
rp2 = requests.put(url, headers=headers, json=body, timeout=15)
print("\nPUT HTTP:", rp2.status_code)
print("PUT body:", rp2.content.decode("utf-8", errors="replace").strip()[:200])
