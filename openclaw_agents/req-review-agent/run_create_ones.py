"""直接运行，创建 Feishu recFfbX9b0 对应的 ONES 工单"""
import json, requests, os, random, string, sys

cache = json.load(open(os.path.join(os.path.dirname(__file__), "token_cache.json"), encoding="utf-8"))
T = cache["token"]
C = cache["cookie"]
H = {
    "Authorization": f"Bearer {T}", "Cookie": C,
    "Content-Type": "application/json",
    "Referer": "https://ones.winnermedical.com/project/"
}

USER_UUID  = "5ktr445N"
TEAM_UUID  = "BSsxXFv2"
PROJ_UUID  = "QE2GXyz1K1Z1aDui"
URL        = f"https://ones.winnermedical.com/project/api/project/team/{TEAM_UUID}/tasks/add"
LINK_TPL   = f"https://ones.winnermedical.com/project/#/team/{TEAM_UUID}/project/{PROJ_UUID}/issue/{{uuid}}"

def gen_uuid():
    return USER_UUID + ''.join(random.choices(string.ascii_letters + string.digits, k=8))

title = "tob -退货装箱加工报表  修改"
desc  = (
    "1.这个报表如果装箱改包的，只有点击尾数装箱才能显示，"
    "点击标签打印就显示都没有。\n"
    "2.用RF进行装箱加工，一定要达到箱含量才能改，"
    "之前我记得是可以不满足箱含量也可以改的。"
)
desc_html = "<p>" + desc.replace("\n", "</p>\n<p>") + "</p>"

severity_uuid = "Gjh8TNF3"   # P1（来自 config）
issue_type    = "TNVWjjtZ"   # 问题缺陷

task_uuid = gen_uuid()
payload = {
    "tasks": [{
        "uuid":            task_uuid,
        "assign":          USER_UUID,
        "summary":         title,
        "parent_uuid":     "",
        "issue_type_uuid": issue_type,
        "project_uuid":    PROJ_UUID,
        "watchers":        [USER_UUID],
        "field_values": [
            {"field_uuid": "field001", "type": 2,  "value": title},
            {"field_uuid": "field016", "type": 20, "value": desc_html},
            {"field_uuid": "ScqUnZYX", "type": 15, "value": desc},
            {"field_uuid": "field038", "type": 1,  "value": severity_uuid},
            {"field_uuid": "field004", "type": 8,  "value": USER_UUID},
            {"field_uuid": "field029", "type": 44, "value": ["QE2GXyz1QGmiMX55"]},  # 全棉WMS
        ]
    }]
}

print(f"发送请求: {URL}")
r = requests.post(URL, headers=H, json=payload, timeout=30)
print(f"HTTP {r.status_code}")
print(r.text)

result = r.json()
if r.status_code == 200 and result.get("tasks"):
    real_uuid = result["tasks"][0].get("uuid", task_uuid)
    link = LINK_TPL.format(uuid=real_uuid)
    print(f"\n[成功]")
    print(f"  task_uuid = {real_uuid}")
    print(f"  ones_url  = {link}")
elif result.get("bad_tasks"):
    print(f"\n[失败] {result['bad_tasks']}")
    sys.exit(1)
