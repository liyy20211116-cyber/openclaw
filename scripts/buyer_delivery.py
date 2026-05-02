from __future__ import annotations

import datetime as dt
import importlib
import json
import os
import platform
import shutil
import subprocess
import sys
import zipfile
from copy import deepcopy
from pathlib import Path
from typing import Any


PROJECT_ROOT_DEFAULT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = PROJECT_ROOT_DEFAULT / "output"
REPORTS_ROOT = OUTPUT_ROOT / "reports"
PERFORMANCE_ROOT = OUTPUT_ROOT / "performance"
BUYER_PACKAGES_ROOT = OUTPUT_ROOT / "buyer-packages"
COMMERCIAL_EVIDENCE_PATH = PERFORMANCE_ROOT / "commercial-evidence-summary.json"

BINARIES = [
    ("git", "--version"),
    ("node", "--version"),
    ("npm", "--version"),
    ("python", "--version"),
    ("ffmpeg", "-version"),
    ("uv", "--version"),
    ("opencli", "--version"),
    ("claude", "--version"),
]

PY_PKGS = [
    "pillow",
    "requests",
    "wxauto",
    "edge_tts",
    "whisper",
]

EXTERNAL_REPOS = [
    ("tools/videocut", "zinan92/videocut"),
    ("tools/openclip", "linzzzzzz/openclip"),
    ("tools/Clip2Post", "WtecHtec/Clip2Post"),
    ("tools/OpenCLI", "jackwener/opencli"),
]

REQUIRED_TEMPLATE_PATHS = [
    "config/app-config.json",
    "config/integrations.json",
    "config/model-routing.json",
    "config/workflow-templates.json",
    "config/service-packages.json",
    "config/README.md",
    "config/onboarding-guide.md",
    "config/tenant/default/tenant.json",
    "config/tenant/default/branding.json",
    "config/tenant/default/commerce.json",
    "config/tenant/default/features.json",
    "config/tenant/default/token-economy.json",
    "config/tenant/default/integrations/README.md",
]

REQUIRED_ONBOARDING_DOCS = [
    "docs/startup-checklist.md",
    "docs/sales/onboarding-sop.md",
    "config/onboarding-guide.md",
    "config/README.md",
]


def now_iso() -> str:
    return dt.datetime.now().replace(microsecond=0).isoformat()


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    ensure_dir(path.parent)
    path.write_text(content, encoding="utf-8")


def clean_path(path: Path) -> None:
    if path.is_dir():
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()


def is_placeholder(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return True
        upper = normalized.upper()
        placeholder_markers = (
            "TODO",
            "CHANGE_ME",
            "REPLACE_ME",
            "待",
            "未提供",
            "未配置",
            "YOUR_",
        )
        return any(marker in upper or marker in normalized for marker in placeholder_markers)
    return False


def check_binary(name: str, arg: str) -> dict[str, Any]:
    if shutil.which(name) is None:
        return {"name": name, "ok": False, "version": None}
    try:
        out = subprocess.run(
            [name, arg],
            capture_output=True,
            text=True,
            timeout=10,
            encoding="utf-8",
            errors="ignore",
            check=False,
        )
        version = (out.stdout or out.stderr or "").strip().splitlines()[0] if (out.stdout or out.stderr) else "(unknown)"
    except Exception as exc:
        version = f"error: {exc}"
    return {"name": name, "ok": True, "version": version}


def check_py_package(pkg: str) -> dict[str, Any]:
    try:
        module = importlib.import_module(pkg.replace("-", "_"))
        version = getattr(module, "__version__", "(no __version__)")
        return {"name": pkg, "ok": True, "version": version}
    except Exception:
        return {"name": pkg, "ok": False, "version": None}


def check_repo(project_root: Path, rel_path: str, upstream: str) -> dict[str, Any]:
    path = project_root / rel_path
    return {
        "rel_path": rel_path,
        "upstream": upstream,
        "exists": path.exists(),
        "has_skill_md": (path / "SKILL.md").exists() if path.exists() else False,
    }


def analyze_template_coverage(project_root: Path) -> dict[str, Any]:
    present: list[str] = []
    missing: list[str] = []
    for rel_path in REQUIRED_TEMPLATE_PATHS:
        full_path = project_root / rel_path
        if full_path.exists():
            present.append(rel_path)
        else:
            missing.append(rel_path)
    return {
        "required": len(REQUIRED_TEMPLATE_PATHS),
        "coverage": len(present),
        "missing": missing,
        "present": present,
        "ready": len(missing) == 0,
    }


def build_onboarding_checklist_result(project_root: Path, output_dir: Path | None = None) -> dict[str, Any]:
    docs: list[dict[str, Any]] = []
    missing_docs: list[str] = []
    for rel_path in REQUIRED_ONBOARDING_DOCS:
        exists = (project_root / rel_path).exists()
        docs.append({"path": rel_path, "exists": exists})
        if not exists:
            missing_docs.append(rel_path)

    checklist = {
        "generated_at": now_iso(),
        "status": "ready" if not missing_docs else "needs_attention",
        "docs_ready": not missing_docs,
        "checklist_ready": not missing_docs,
        "missing_docs": missing_docs,
        "docs": docs,
        "buyer_must_provide": [
            "At least one LLM provider credential or local CLI proxy access",
            "Notification channel credentials if Feishu or WeCom alerts are needed",
            "Payment collection path or QR assets",
            "Tenant branding and business information",
        ],
        "system_ready": [
            "License issuing and verification scripts exist",
            "Buyer self-check script exists",
            "Template config skeleton exists",
            "Fixed first-run acceptance task exists",
        ],
        "gap_fill_actions": [
            "Run scripts/env_check.py to identify missing launch blockers and optional gaps",
            "Fill config templates in the package before first production use",
            "Activate the buyer license before running first acceptance",
        ],
        "acceptance_criteria": [
            "License verification succeeds or a valid activation code is present",
            "Buyer self-check reports ready or clearly explains remaining optional gaps",
            "Launch entrypoints exist",
            "First-run acceptance writes a success report",
        ],
        "first_run_sequence": [
            "Activate or verify the license",
            "Run buyer self-check",
            "Fill the required config items",
            "Start the system",
            "Run first-run acceptance",
        ],
    }
    if output_dir is not None:
        ensure_dir(output_dir)
        write_json(output_dir / "onboarding-checklist-result.json", checklist)
    return checklist


def check_llm_ready(project_root: Path) -> tuple[bool, str]:
    config_path = project_root / "config" / "app-config.json"
    if not config_path.exists():
        return False, "config/app-config.json missing"
    config = read_json(config_path)
    llm = config.get("llm") or {}
    providers = llm.get("providers") or []
    for provider in providers:
        if not provider.get("enabled"):
            continue
        provider_type = str(provider.get("type") or "")
        if provider_type == "cliproxy" and provider.get("port"):
            return True, f"{provider.get('id', 'cliproxy')} enabled"
        if not is_placeholder(provider.get("api_key")):
            return True, f"{provider.get('id', 'provider')} configured"
    return False, "no enabled provider with usable credential or local proxy"


def check_notification_ready(project_root: Path) -> tuple[bool, str]:
    config_path = project_root / "config" / "integrations.json"
    if not config_path.exists():
        return False, "config/integrations.json missing"
    config = read_json(config_path)
    feishu = config.get("feishu") or {}
    if feishu.get("enabled") and not any(
        is_placeholder(feishu.get(key))
        for key in ("app_id", "app_secret", "bot_webhook_url")
    ):
        return True, "Feishu channel configured"
    wecom = ((config.get("outreach") or {}).get("wecom")) or {}
    if wecom.get("enabled") and not any(
        is_placeholder(wecom.get(key))
        for key in ("corp_id", "agent_id", "agent_secret")
    ):
        return True, "WeCom channel configured"
    return False, "notification channel not configured"


def check_payment_ready(project_root: Path) -> tuple[bool, str]:
    payment_path = project_root / "config" / "payment-info.json"
    if payment_path.exists():
        payment = read_json(payment_path)
        alipay = payment.get("alipay") or {}
        wechat = payment.get("wechat_pay") or {}
        if alipay.get("enabled") and not is_placeholder(alipay.get("qr_image_path")):
            return True, "Alipay payment path configured"
        if wechat.get("enabled") and not is_placeholder(wechat.get("qr_image_path")):
            return True, "WeChat payment path configured"
    commerce_path = project_root / "config" / "tenant" / "default" / "commerce.json"
    if commerce_path.exists():
        commerce = read_json(commerce_path)
        qr = commerce.get("personal_qr") or {}
        if not is_placeholder(qr.get("wechat_qr_path")) or not is_placeholder(qr.get("alipay_qr_path")):
            return True, "Tenant commerce QR template configured"
    return False, "payment channel not configured"


def check_license_chain(project_root: Path) -> dict[str, Any]:
    issue_script = project_root / "scripts" / "license" / "issue.py"
    verify_script = project_root / "scripts" / "license" / "verify.py"
    local_candidates = [
        project_root / "config" / "tenant" / "default" / "license.txt",
        project_root / "config" / "license.txt",
    ]
    local_license = next((str(path.relative_to(project_root)) for path in local_candidates if path.exists()), "")
    return {
        "issue_script": str(issue_script.relative_to(project_root)),
        "verify_script": str(verify_script.relative_to(project_root)),
        "issue_script_ready": issue_script.exists(),
        "verify_script_ready": verify_script.exists(),
        "local_license_path": local_license,
        "local_license_present": bool(local_license),
        "ready": issue_script.exists() and verify_script.exists(),
    }


def run_buyer_self_check(project_root: Path, output_dir: Path | None = None) -> dict[str, Any]:
    binaries = [check_binary(name, arg) for name, arg in BINARIES]
    py_packages = [check_py_package(pkg) for pkg in PY_PKGS]
    external_repos = [check_repo(project_root, rel_path, upstream) for rel_path, upstream in EXTERNAL_REPOS]

    llm_ready, llm_detail = check_llm_ready(project_root)
    notification_ready, notification_detail = check_notification_ready(project_root)
    payment_ready, payment_detail = check_payment_ready(project_root)
    template_summary = analyze_template_coverage(project_root)
    onboarding = build_onboarding_checklist_result(project_root)
    license_chain = check_license_chain(project_root)
    acceptance_script = project_root / "scripts" / "run_buyer_acceptance.py"

    blockers: list[dict[str, Any]] = []
    advisory: list[dict[str, Any]] = []

    missing_binaries = [item["name"] for item in binaries if not item["ok"]]
    if missing_binaries:
        blockers.append({
            "id": "environment",
            "severity": "blocking",
            "detail": f"missing binaries: {', '.join(missing_binaries)}",
        })

    if not llm_ready:
        blockers.append({
            "id": "llm",
            "severity": "blocking",
            "detail": llm_detail,
        })

    if not template_summary["ready"]:
        blockers.append({
            "id": "config_templates",
            "severity": "blocking",
            "detail": f"missing templates: {', '.join(template_summary['missing'])}",
        })

    if not license_chain["ready"]:
        blockers.append({
            "id": "license",
            "severity": "blocking",
            "detail": "license issuing or verification script missing",
        })

    if not acceptance_script.exists():
        blockers.append({
            "id": "acceptance",
            "severity": "blocking",
            "detail": "scripts/run_buyer_acceptance.py missing",
        })

    if not notification_ready:
        advisory.append({
            "id": "notifications",
            "severity": "advisory",
            "detail": notification_detail,
        })

    if not payment_ready:
        advisory.append({
            "id": "payments",
            "severity": "advisory",
            "detail": payment_detail,
        })

    if not onboarding["docs_ready"]:
        advisory.append({
            "id": "onboarding_docs",
            "severity": "advisory",
            "detail": f"missing docs: {', '.join(onboarding['missing_docs'])}",
        })

    suggested_actions: list[str] = []
    if missing_binaries:
        suggested_actions.append(f"Install required binaries: {', '.join(missing_binaries)}")
    if not llm_ready:
        suggested_actions.append("Configure at least one LLM provider or enable a local CLI proxy in config/app-config.json")
    if not notification_ready:
        suggested_actions.append("Fill Feishu or WeCom notification settings in config/integrations.json")
    if not payment_ready:
        suggested_actions.append("Fill payment-info.json or tenant/default/commerce.json with a payment collection path")
    if not template_summary["ready"]:
        suggested_actions.append("Restore the required template files before shipping the buyer package")
    if not license_chain["ready"]:
        suggested_actions.append("Keep both scripts/license/issue.py and scripts/license/verify.py in the delivery bundle")
    if not acceptance_script.exists():
        suggested_actions.append("Add scripts/run_buyer_acceptance.py so the buyer can verify first launch")

    if blockers:
        status = "blocked"
    elif advisory:
        status = "needs_attention"
    else:
        status = "ready"

    result = {
        "generated_at": now_iso(),
        "status": status,
        "ready_to_launch": not blockers,
        "platform": f"{platform.system()} {platform.release()}",
        "python": sys.version.split()[0],
        "binaries": binaries,
        "py_packages": py_packages,
        "external_repos": external_repos,
        "checks": {
            "llm": {"ready": llm_ready, "detail": llm_detail},
            "notifications": {"ready": notification_ready, "detail": notification_detail},
            "payments": {"ready": payment_ready, "detail": payment_detail},
            "config_templates": template_summary,
            "onboarding": onboarding,
            "license_flow": license_chain,
            "acceptance": {
                "ready": acceptance_script.exists(),
                "script": "scripts/run_buyer_acceptance.py",
            },
        },
        "missing_items": blockers + advisory,
        "suggested_actions": suggested_actions,
    }

    if output_dir is not None:
        ensure_dir(output_dir)
        write_json(output_dir / "buyer-self-check-report.json", result)
        write_text(output_dir / "buyer-self-check-report.md", emit_buyer_self_check_markdown(result))
    return result


def emit_buyer_self_check_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Buyer Self-Check Report",
        "",
        f"- Generated at: {report['generated_at']}",
        f"- Status: {report['status']}",
        f"- Ready to launch: {'yes' if report['ready_to_launch'] else 'no'}",
        "",
        "## Launch Gate",
        "",
        f"- Ready: {'yes' if report['ready_to_launch'] else 'no'}",
        "",
        "## Missing Items",
        "",
    ]
    if not report["missing_items"]:
        lines.append("- None")
    else:
        for item in report["missing_items"]:
            lines.append(f"- [{item['severity']}] {item['id']}: {item['detail']}")
    lines.extend([
        "",
        "## Suggested Actions",
        "",
    ])
    if not report["suggested_actions"]:
        lines.append("- None")
    else:
        for action in report["suggested_actions"]:
            lines.append(f"- {action}")
    lines.extend([
        "",
        "## Required Flow",
        "",
        "1. Activate or verify the license",
        "2. Run buyer self-check",
        "3. Fill required config items",
        "4. Start the system",
        "5. Run first-run acceptance",
        "",
    ])
    return "\n".join(lines)


def sanitize_app_config(raw: dict[str, Any]) -> dict[str, Any]:
    payload = deepcopy(raw)
    payload["_doc"] = "Buyer template config. Fill with your own tenant and provider information."
    contact = payload.setdefault("contact", {})
    for key in ("name", "phone", "email", "wechat"):
        contact[key] = f"TODO_{key}"
    company = payload.setdefault("company", {})
    company["name"] = "TODO_company_name"
    company["ceo_name"] = "TODO_ceo_name"
    llm = payload.setdefault("llm", {})
    llm["default_provider"] = ""
    llm["default_model"] = ""
    for provider in llm.get("providers", []):
        if "api_key" in provider:
            provider["api_key"] = ""
        provider["enabled"] = False
    return payload


def sanitize_payment_info(raw: dict[str, Any]) -> dict[str, Any]:
    payload = deepcopy(raw)
    payload["company_name"] = "TODO_company_name"
    payload["contact_name"] = "TODO_contact_name"
    payload["contact_phone"] = "TODO_contact_phone"
    payload["contact_email"] = "TODO_contact_email"
    payload["contact_wechat"] = "TODO_contact_wechat"
    for section in ("bank", "alipay", "wechat_pay"):
        block = payload.get(section) or {}
        block["enabled"] = False
        for key, value in list(block.items()):
            if isinstance(value, str) and key != "note":
                block[key] = f"TODO_{section}_{key}"
        payload[section] = block
    return payload


def sanitize_commerce(raw: dict[str, Any]) -> dict[str, Any]:
    payload = deepcopy(raw)
    personal_qr = payload.setdefault("personal_qr", {})
    personal_qr["alipay_qr_path"] = "TODO_assets/qr/alipay.png"
    personal_qr["wechat_qr_path"] = "TODO_assets/qr/wechat.png"
    personal_qr["receiver_name"] = "TODO_receiver_name"
    bank_account = payload.setdefault("bank_account", {})
    for key in ("company_name", "account_number", "bank_name", "bank_branch", "tax_id"):
        bank_account[key] = f"TODO_{key}"
    invoice = payload.setdefault("invoice", {})
    invoice["provider_api_key"] = ""
    return payload


def copy_tree(src: Path, dst: Path) -> None:
    ensure_dir(dst)
    for entry in src.iterdir():
        target = dst / entry.name
        if entry.is_dir():
            copy_tree(entry, target)
        else:
            shutil.copyfile(entry, target)


def build_consolidated_buyer_doc() -> str:
    return """# Buyer Start Here

This package is a consulting-buyer delivery template.

## What You Must Provide

- One usable LLM provider credential or local CLI proxy access
- Notification channel credentials if you want alerts
- Payment collection path or QR assets
- Tenant branding and contact information

## What Is Already Prepared

- License issue and verify scripts
- Buyer self-check entrypoint
- Fixed first-run acceptance task
- Config template skeleton and onboarding docs

## Fixed Launch Sequence

1. Activate or verify the license
2. Run self-check
3. Fill required configuration
4. Start the system
5. Run first-run acceptance

## Success Criteria

- Self-check is either ready or clearly explains optional gaps
- Launch entrypoints exist
- Acceptance writes a report showing the system is alive
"""


def generate_buyer_package_manifest(
    project_root: Path,
    package_dir: Path,
    zip_path: Path,
    self_check_report_dir: Path,
    onboarding_result_path: Path,
) -> dict[str, Any]:
    categories = [
        {
            "name": "runtime_entrypoints",
            "files": [
                "launch.bat",
                "compat-launch.bat",
                "runtime/launch-jarvis.ps1",
                "runtime/JarvisOS.vbs",
            ],
        },
        {
            "name": "config_templates",
            "files": [
                "config-templates/app-config.template.json",
                "config-templates/integrations.template.json",
                "config-templates/payment-info.template.json",
                "config-templates/tenant/default/commerce.template.json",
                "config-templates/tenant/default/branding.template.json",
                "config-templates/tenant/default/features.template.json",
                "config-templates/tenant/default/token-economy.template.json",
            ],
        },
        {
            "name": "self_check",
            "files": [
                "scripts/env_check.py",
                "scripts/run_buyer_acceptance.py",
                "scripts/license/verify.py",
                "scripts/license/issue.py",
                "reports/buyer-self-check-report.json",
                "reports/buyer-self-check-report.md",
            ],
        },
        {
            "name": "onboarding_docs",
            "files": [
                "START_HERE.md",
                "docs/startup-checklist.md",
                "docs/sales-onboarding-sop.md",
                "docs/config-onboarding-guide.md",
                "reports/onboarding-checklist-result.json",
            ],
        },
    ]

    manifest = {
        "version": "1.0",
        "generated_at": now_iso(),
        "delivery_mode": "template_package",
        "buyer_type": "consulting",
        "package_dir": str(package_dir),
        "zip_path": str(zip_path),
        "self_check_report": str((self_check_report_dir / "buyer-self-check-report.json").relative_to(package_dir)),
        "onboarding_checklist_result": str(onboarding_result_path.relative_to(package_dir)),
        "license_flow": {
            "verify_script": "scripts/license/verify.py",
            "issue_script": "scripts/license/issue.py",
            "activation_required_before_first_live_run": True,
        },
        "entrypoints": {
            "launch": "launch.bat",
            "compat_launch": "compat-launch.bat",
            "self_check": "self-check.bat",
            "first_acceptance": "first-acceptance.bat",
        },
        "categories": categories,
    }
    return manifest


def zip_directory(source_dir: Path, zip_path: Path) -> None:
    clean_path(zip_path)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source_dir.rglob("*")):
            archive.write(path, path.relative_to(source_dir))


def build_buyer_package(
    project_root: Path,
    output_root: Path | None = None,
    tag: str | None = None,
) -> dict[str, Any]:
    output_root = output_root or BUYER_PACKAGES_ROOT
    ensure_dir(output_root)
    package_name = f"jarvis-os-buyer-template-{tag or dt.datetime.now():%Y%m%d-%H%M%S}"
    package_dir = output_root / package_name
    zip_path = output_root / f"{package_name}.zip"
    clean_path(package_dir)
    ensure_dir(package_dir)

    runtime_dir = ensure_dir(package_dir / "runtime")
    docs_dir = ensure_dir(package_dir / "docs")
    config_dir = ensure_dir(package_dir / "config-templates")
    scripts_dir = ensure_dir(package_dir / "scripts" / "license")
    reports_dir = ensure_dir(package_dir / "reports")

    for source, target in [
        (project_root / "launch-jarvis.ps1", runtime_dir / "launch-jarvis.ps1"),
        (project_root / "JarvisOS.vbs", runtime_dir / "JarvisOS.vbs"),
        (project_root / "scripts" / "env_check.py", package_dir / "scripts" / "env_check.py"),
        (project_root / "scripts" / "run_buyer_acceptance.py", package_dir / "scripts" / "run_buyer_acceptance.py"),
        (project_root / "scripts" / "license" / "verify.py", scripts_dir / "verify.py"),
        (project_root / "scripts" / "license" / "issue.py", scripts_dir / "issue.py"),
        (project_root / "docs" / "startup-checklist.md", docs_dir / "startup-checklist.md"),
        (project_root / "docs" / "sales" / "onboarding-sop.md", docs_dir / "sales-onboarding-sop.md"),
        (project_root / "config" / "onboarding-guide.md", docs_dir / "config-onboarding-guide.md"),
        (project_root / "config" / "README.md", docs_dir / "config-readme.md"),
    ]:
        if source.exists():
            ensure_dir(target.parent)
            shutil.copyfile(source, target)

    app_config = sanitize_app_config(read_json(project_root / "config" / "app-config.json"))
    integrations = read_json(project_root / "config" / "integrations.json")
    payment_info = sanitize_payment_info(read_json(project_root / "config" / "payment-info.json"))
    branding = read_json(project_root / "config" / "tenant" / "default" / "branding.json")
    features = read_json(project_root / "config" / "tenant" / "default" / "features.json")
    token_economy = read_json(project_root / "config" / "tenant" / "default" / "token-economy.json")
    commerce = sanitize_commerce(read_json(project_root / "config" / "tenant" / "default" / "commerce.json"))

    write_json(config_dir / "app-config.template.json", app_config)
    write_json(config_dir / "integrations.template.json", integrations)
    write_json(config_dir / "payment-info.template.json", payment_info)
    write_json(config_dir / "tenant" / "default" / "branding.template.json", branding)
    write_json(config_dir / "tenant" / "default" / "features.template.json", features)
    write_json(config_dir / "tenant" / "default" / "token-economy.template.json", token_economy)
    write_json(config_dir / "tenant" / "default" / "commerce.template.json", commerce)

    write_text(package_dir / "START_HERE.md", build_consolidated_buyer_doc())
    write_text(
        package_dir / "launch.bat",
        "@echo off\r\npowershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File \"%~dp0runtime\\launch-jarvis.ps1\"\r\n",
    )
    write_text(
        package_dir / "compat-launch.bat",
        "@echo off\r\ncall \"%~dp0launch.bat\"\r\n",
    )
    write_text(
        package_dir / "self-check.bat",
        "@echo off\r\npython \"%~dp0scripts\\env_check.py\" --project-root \"%~dp0\" --output-dir \"%~dp0reports\"\r\n",
    )
    write_text(
        package_dir / "first-acceptance.bat",
        "@echo off\r\npython \"%~dp0scripts\\run_buyer_acceptance.py\" --project-root \"%~dp0\" --report-dir \"%~dp0reports\"\r\n",
    )

    onboarding = build_onboarding_checklist_result(project_root, reports_dir)
    self_check = run_buyer_self_check(project_root, reports_dir)
    manifest = generate_buyer_package_manifest(
        project_root=project_root,
        package_dir=package_dir,
        zip_path=zip_path,
        self_check_report_dir=reports_dir,
        onboarding_result_path=reports_dir / "onboarding-checklist-result.json",
    )
    write_json(package_dir / "buyer-package-manifest.json", manifest)
    zip_directory(package_dir, zip_path)

    evidence = persist_commercial_evidence_summary(project_root)
    return {
        "package_dir": package_dir,
        "zip_path": zip_path,
        "manifest": manifest,
        "self_check": self_check,
        "onboarding": onboarding,
        "commercial_evidence": evidence,
    }


def find_latest_manifest(project_root: Path) -> Path | None:
    root = project_root / "output" / "buyer-packages"
    candidates = sorted(root.glob("**/buyer-package-manifest.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0] if candidates else None


def find_latest_report(project_root: Path, name: str) -> Path | None:
    candidates = sorted((project_root / "output" / "reports").glob(f"**/{name}"), key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0] if candidates else None


def build_commercial_evidence_summary(project_root: Path) -> dict[str, Any]:
    manifest_path = find_latest_manifest(project_root)
    self_check_path = find_latest_report(project_root, "buyer-self-check-report.json")
    onboarding_path = find_latest_report(project_root, "onboarding-checklist-result.json")
    template_summary = analyze_template_coverage(project_root)
    license_chain = check_license_chain(project_root)
    acceptance_script = project_root / "scripts" / "run_buyer_acceptance.py"

    self_check_status = "missing"
    self_check_ready = False
    if self_check_path and self_check_path.exists():
        self_check = read_json(self_check_path)
        self_check_status = str(self_check.get("status") or "missing")
        self_check_ready = bool(self_check.get("ready_to_launch"))

    onboarding_ready = False
    onboarding_docs_ready = False
    if onboarding_path and onboarding_path.exists():
        onboarding = read_json(onboarding_path)
        onboarding_ready = bool(onboarding.get("checklist_ready"))
        onboarding_docs_ready = bool(onboarding.get("docs_ready"))

    coverage_rate = (template_summary["coverage"] / template_summary["required"]) if template_summary["required"] else 0
    self_check_rate_map = {
        "ready": 1.0,
        "needs_attention": 0.65,
        "blocked": 0.25,
        "missing": 0.0,
    }
    evidence_score = round(
        (
            (1.0 if manifest_path else 0.0)
            + self_check_rate_map.get(self_check_status, 0.0)
            + coverage_rate
            + (1.0 if onboarding_ready and onboarding_docs_ready else 0.0)
            + (1.0 if license_chain["ready"] else 0.0)
            + (1.0 if acceptance_script.exists() else 0.0)
        ) / 6,
        3,
    )

    return {
        "generatedAt": now_iso(),
        "packageManifestReady": bool(manifest_path),
        "latestManifestPath": str(manifest_path) if manifest_path else "",
        "selfCheckStatus": self_check_status,
        "selfCheckReadyToLaunch": self_check_ready,
        "selfCheckReportPath": str(self_check_path) if self_check_path else "",
        "configTemplateCoverage": template_summary["coverage"],
        "configTemplateRequired": template_summary["required"],
        "configTemplateMissing": template_summary["missing"],
        "onboardingDocReady": onboarding_docs_ready,
        "onboardingChecklistReady": onboarding_ready,
        "onboardingChecklistPath": str(onboarding_path) if onboarding_path else "",
        "licenseFlowReady": bool(license_chain["ready"]),
        "acceptanceScriptReady": acceptance_script.exists(),
        "evidenceScore": evidence_score,
    }


def persist_commercial_evidence_summary(project_root: Path) -> dict[str, Any]:
    summary = build_commercial_evidence_summary(project_root)
    write_json(project_root / "output" / "performance" / "commercial-evidence-summary.json", summary)
    return summary
