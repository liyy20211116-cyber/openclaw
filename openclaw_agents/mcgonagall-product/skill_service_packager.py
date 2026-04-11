"""麦格·产品部 — 服务包定义器
定义和管理可销售的标准化服务包。
"""
import json, os
from datetime import datetime

ROOT = r"D:\FY003"
OUTPUT = os.path.join(ROOT, "output")
DATA_DIR = os.path.join(ROOT, "data_raw")
os.makedirs(OUTPUT, exist_ok=True)

SERVICE_CATALOG_FILE = os.path.join(DATA_DIR, "service_catalog.json")

DEFAULT_SERVICES = [
    {
        "id": "SVC-001",
        "name": "AI Workflow Automation Consulting",
        "name_cn": "AI 工作流自动化咨询",
        "description": "Analyze client workflows, identify automation opportunities, deliver actionable plan",
        "deliverables": ["Workflow analysis report", "Automation opportunity map", "Implementation roadmap", "ROI projection"],
        "duration": "1 week",
        "price": 5000,
        "currency": "CNY",
        "target_client": "SMB with repetitive manual processes",
        "status": "active"
    },
    {
        "id": "SVC-002",
        "name": "Custom AI Agent Development",
        "name_cn": "定制 AI Agent 开发",
        "description": "Build and deploy custom AI agents for specific business processes",
        "deliverables": ["Requirements document", "Custom agent code", "Deployment guide", "30-day support"],
        "duration": "2-4 weeks",
        "price": 15000,
        "currency": "CNY",
        "target_client": "Companies needing specific AI automation",
        "status": "active"
    },
    {
        "id": "SVC-003",
        "name": "AI Transformation Workshop",
        "name_cn": "AI 转型工作坊",
        "description": "Half-day workshop teaching teams to leverage AI tools effectively",
        "deliverables": ["Workshop materials", "Hands-on exercises", "Tool recommendation list", "Follow-up Q&A"],
        "duration": "4 hours",
        "price": 3000,
        "currency": "CNY",
        "target_client": "Teams new to AI tools",
        "status": "active"
    },
    {
        "id": "SVC-004",
        "name": "Monthly AI Operations Retainer",
        "name_cn": "月度 AI 运维服务",
        "description": "Ongoing AI agent monitoring, optimization, and support",
        "deliverables": ["Monthly performance report", "Agent optimization", "Priority support", "New feature implementation"],
        "duration": "Monthly",
        "price": 3000,
        "currency": "CNY",
        "target_client": "Existing clients with deployed agents",
        "status": "active"
    }
]

def main():
    print("=== Service Catalog Manager ===\n")

    if os.path.exists(SERVICE_CATALOG_FILE):
        catalog = json.load(open(SERVICE_CATALOG_FILE, "r", encoding="utf-8"))
        print(f"Loaded catalog: {len(catalog.get('services', []))} services")
    else:
        catalog = {
            "company": "One Person Company",
            "created_at": datetime.now().isoformat(),
            "services": DEFAULT_SERVICES
        }
        json.dump(catalog, open(SERVICE_CATALOG_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"Created default catalog: {len(DEFAULT_SERVICES)} services")

    print(f"\n--- Active Services ---\n")
    total_potential = 0
    for svc in catalog.get("services", []):
        if svc["status"] != "active":
            continue
        print(f"  [{svc['id']}] {svc['name_cn']}")
        print(f"         Price: CNY{svc['price']:,} | Duration: {svc['duration']}")
        print(f"         Target: {svc['target_client']}")
        print(f"         Deliverables: {', '.join(svc['deliverables'][:3])}")
        print()
        total_potential += svc["price"]

    print(f"--- Revenue Potential ---")
    print(f"  If each service sold 1x/month: CNY{total_potential:,}/month")
    print(f"  Annual potential: CNY{total_potential * 12:,}/year")

    out_file = os.path.join(OUTPUT, f"service_catalog_{datetime.now():%Y%m%d}.json")
    json.dump(catalog, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\nCatalog: {out_file}")

if __name__ == "__main__":
    main()
