from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any


def sanitize_id(text: str, fallback: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_]+", "_", text.strip())
    value = value.strip("_")
    return value or fallback


def normalize_lines(raw: str) -> list[str]:
    lines = []
    for line in raw.splitlines():
        cleaned = line.strip()
        if not cleaned:
            continue
        cleaned = re.sub(r"^[0-9]+[.)、\-\s]+", "", cleaned)
        cleaned = re.sub(r"^[\-\*•]+\s*", "", cleaned)
        if cleaned:
            lines.append(cleaned)
    return lines


def escape_mermaid_label(text: str) -> str:
    return text.replace("\\", "\\\\").replace('"', "'")


def build_mermaid(title: str, steps: list[str]) -> str:
    graph_lines = ["flowchart TD"]
    node_ids: list[str] = []
    for index, step in enumerate(steps, start=1):
        node_id = sanitize_id(step, f"step_{index}")
        while node_id in node_ids:
            node_id = f"{node_id}_{index}"
        node_ids.append(node_id)
        graph_lines.append(f'    {node_id}["{index}. {escape_mermaid_label(step)}"]')

    for left, right in zip(node_ids, node_ids[1:]):
        graph_lines.append(f"    {left} --> {right}")

    if title.strip():
        graph_lines.append("    classDef title fill:#f5f7ff,stroke:#4c6ef5,stroke-width:1px,color:#111827;")
        graph_lines.append(f'    title_node["{escape_mermaid_label(title)}"]:::title')
        if node_ids:
            graph_lines.append(f"    title_node --> {node_ids[0]}")

    return "\n".join(graph_lines) + "\n"


def detect_mermaid_cli() -> str | None:
    for candidate in ("mmdc", "mmdc.cmd", "mmdc.ps1"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    return None


def resolve_render_formats(render_mode: str, renderer: str | None) -> list[str]:
    if render_mode == "none":
        return []
    if render_mode == "auto":
        return ["png"] if renderer else []
    if render_mode == "both":
        return ["png", "svg"]
    return [render_mode]


def render_mermaid(renderer: str, mermaid_path: Path, output_path: Path) -> dict[str, object]:
    command = [renderer, "-i", str(mermaid_path), "-o", str(output_path), "-b", "transparent"]
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    return {
        "command": command,
        "returncode": completed.returncode,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
        "ok": completed.returncode == 0 and output_path.exists(),
    }


def build_summary(steps: list[str]) -> str:
    return "\n".join(f"{i}. {step}" for i, step in enumerate(steps, start=1)) + "\n"


def build_doc_markdown(title: str, steps: list[str], rendered_files: list[Path], mermaid_path: Path, summary_path: Path) -> str:
    lines = [f"# {title}", "", "## 流程步骤", ""]
    lines.extend(f"{index}. {step}" for index, step in enumerate(steps, start=1))
    lines.extend(["", "## 产物清单", ""])
    if rendered_files:
        for path in rendered_files:
            lines.append(f"- 图片文件：`{path}`")
    else:
        lines.append("- 当前环境未检测到可用 Mermaid CLI，暂未生成图片文件。")
    lines.append(f"- Mermaid 源文件：`{mermaid_path}`")
    lines.append(f"- 步骤摘要：`{summary_path}`")
    lines.extend(
        [
            "",
            "## 飞书落地建议",
            "",
            "- 若已有图片，优先上传图片到飞书文档。",
            "- 若当前没有图片，先上传 `.mmd` 与步骤摘要附件，后续安装渲染器后再补图片。",
        ]
    )
    return "\n".join(lines) + "\n"


def build_upload_manifest(
    title: str,
    source: Path,
    mermaid_path: Path,
    summary_path: Path,
    doc_markdown_path: Path,
    rendered_files: list[Path],
    renderer: str | None,
    render_mode: str,
    steps: list[str],
) -> dict[str, object]:
    preferred_assets = [str(path) for path in rendered_files] + [str(mermaid_path), str(summary_path)]
    upload_steps = []
    if rendered_files:
        upload_steps.append("先将图片上传到飞书文档，作为正文中的流程图展示。")
    else:
        upload_steps.append("当前未生成图片，先将 Mermaid 源文件或步骤摘要作为附件上传到飞书文档。")
    upload_steps.extend(
        [
            "将文档草稿内容写入飞书文档正文。",
            "如果后续装好 Mermaid CLI，可重新执行本脚本补齐图片后再上传。",
        ]
    )
    return {
        "ok": True,
        "title": title,
        "input_file": str(source),
        "steps_count": len(steps),
        "render_mode": render_mode,
        "renderer": renderer,
        "preferred_upload_assets": preferred_assets,
        "doc_markdown_file": str(doc_markdown_path),
        "attachments": {
            "mermaid_file": str(mermaid_path),
            "summary_file": str(summary_path),
            "rendered_files": [str(path) for path in rendered_files],
        },
        "upload_steps": upload_steps,
    }


def build_feishu_publish_plan(
    doc_token: str,
    doc_markdown: str,
    doc_markdown_path: Path,
    rendered_files: list[Path],
    mermaid_path: Path,
    summary_path: Path,
) -> dict[str, Any]:
    operations: list[dict[str, Any]] = [
        {
            "name": "write_doc_markdown",
            "tool": "feishu_doc",
            "payload": {
                "action": "write",
                "doc_token": doc_token,
                "content": doc_markdown,
            },
            "content_file": str(doc_markdown_path),
        }
    ]

    if rendered_files:
        for rendered_path in rendered_files:
            operations.append(
                {
                    "name": f"upload_image_{rendered_path.suffix.lstrip('.')}",
                    "tool": "feishu_doc",
                    "payload": {
                        "action": "upload_image",
                        "doc_token": doc_token,
                        "file_path": str(rendered_path),
                    },
                }
            )
    else:
        operations.extend(
            [
                {
                    "name": "upload_mermaid_attachment",
                    "tool": "feishu_doc",
                    "payload": {
                        "action": "upload_file",
                        "doc_token": doc_token,
                        "file_path": str(mermaid_path),
                        "filename": mermaid_path.name,
                    },
                },
                {
                    "name": "upload_summary_attachment",
                    "tool": "feishu_doc",
                    "payload": {
                        "action": "upload_file",
                        "doc_token": doc_token,
                        "file_path": str(summary_path),
                        "filename": summary_path.name,
                    },
                },
            ]
        )

    return {
        "ok": True,
        "doc_token": doc_token,
        "mode": "image_first" if rendered_files else "attachment_first",
        "operations": operations,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Render workflow text to Mermaid source and optional image outputs")
    parser.add_argument("--title", default="Workflow Diagram")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-stem", default="workflow_diagram")
    parser.add_argument("--render", choices=["auto", "none", "png", "svg", "both"], default="auto")
    parser.add_argument("--doc-token")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    workspace_root = Path(__file__).resolve().parent.parent
    input_dir = workspace_root / "workspace" / "workflow_diagram" / "input"
    output_dir = workspace_root / "workspace" / "workflow_diagram" / "output"
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    source = Path(args.input).resolve()
    try:
        source.relative_to(input_dir.resolve())
    except ValueError:
        print(
            json.dumps(
                {
                    "ok": False,
                    "code": "source_outside_input",
                    "message": "For safety, input must be inside the workflow_diagram input directory.",
                    "input": str(source),
                    "allowed_input_dir": str(input_dir.resolve()),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 2

    if not source.is_file():
        print(
            json.dumps(
                {
                    "ok": False,
                    "code": "source_not_found",
                    "message": "Input text file was not found.",
                    "input": str(source),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 3

    content = source.read_text(encoding="utf-8")
    steps = normalize_lines(content)
    if not steps:
        print(
            json.dumps(
                {
                    "ok": False,
                    "code": "empty_steps",
                    "message": "No valid workflow steps were found in the input file.",
                    "input": str(source),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 4

    safe_stem = sanitize_id(args.output_stem, "workflow_diagram")
    mermaid_path = output_dir / f"{safe_stem}.mmd"
    summary_path = output_dir / f"{safe_stem}.txt"
    doc_markdown_path = output_dir / f"{safe_stem}.md"
    upload_manifest_path = output_dir / f"{safe_stem}.upload.json"
    feishu_plan_path = output_dir / f"{safe_stem}.feishu.json"

    renderer = detect_mermaid_cli()
    render_formats = resolve_render_formats(args.render, renderer)
    rendered_paths = [output_dir / f"{safe_stem}.{fmt}" for fmt in render_formats]
    all_outputs = [mermaid_path, summary_path, doc_markdown_path, upload_manifest_path, *rendered_paths]
    if args.doc_token:
        all_outputs.append(feishu_plan_path)

    if any(path.exists() for path in all_outputs) and not args.overwrite:
        print(
            json.dumps(
                {
                    "ok": False,
                    "code": "target_exists",
                    "message": "Target output already exists. Pass --overwrite to replace it.",
                    "outputs": [str(path) for path in all_outputs],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 5

    if args.render in {"png", "svg", "both"} and not renderer:
        print(
            json.dumps(
                {
                    "ok": False,
                    "code": "renderer_not_found",
                    "message": "Mermaid CLI (mmdc) was not found, so the requested image render could not run.",
                    "render_mode": args.render,
                    "hint": "Install Mermaid CLI or rerun with --render none/auto.",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 6

    mermaid = build_mermaid(args.title, steps)
    mermaid_path.write_text(mermaid, encoding="utf-8")
    summary_path.write_text(build_summary(steps), encoding="utf-8")

    render_results: list[dict[str, object]] = []
    successful_renders: list[Path] = []
    for rendered_path in rendered_paths:
        result = render_mermaid(renderer, mermaid_path, rendered_path)
        render_results.append(result)
        if result["ok"]:
            successful_renders.append(rendered_path)

    doc_markdown = build_doc_markdown(args.title, steps, successful_renders, mermaid_path, summary_path)
    doc_markdown_path.write_text(doc_markdown, encoding="utf-8")

    upload_manifest = build_upload_manifest(
        title=args.title,
        source=source,
        mermaid_path=mermaid_path,
        summary_path=summary_path,
        doc_markdown_path=doc_markdown_path,
        rendered_files=successful_renders,
        renderer=renderer,
        render_mode=args.render,
        steps=steps,
    )
    upload_manifest_path.write_text(json.dumps(upload_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    feishu_plan_file: str | None = None
    if args.doc_token:
        feishu_plan = build_feishu_publish_plan(
            doc_token=args.doc_token,
            doc_markdown=doc_markdown,
            doc_markdown_path=doc_markdown_path,
            rendered_files=successful_renders,
            mermaid_path=mermaid_path,
            summary_path=summary_path,
        )
        feishu_plan_path.write_text(json.dumps(feishu_plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        feishu_plan_file = str(feishu_plan_path)

    print(
        json.dumps(
            {
                "ok": True,
                "code": "ok",
                "message": "Workflow bundle generated successfully.",
                "title": args.title,
                "input": str(source),
                "steps_count": len(steps),
                "renderer": renderer,
                "render_mode": args.render,
                "rendered_files": [str(path) for path in successful_renders],
                "render_failures": [result for result in render_results if not result["ok"]],
                "mermaid_file": str(mermaid_path),
                "summary_file": str(summary_path),
                "doc_markdown_file": str(doc_markdown_path),
                "upload_manifest_file": str(upload_manifest_path),
                "feishu_publish_plan_file": feishu_plan_file,
                "render_hint": (
                    "PNG image generated and ready for Feishu upload."
                    if successful_renders
                    else "No image renderer detected; upload the .mmd/.txt bundle first, then rerun after installing Mermaid CLI (mmdc)."
                ),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
