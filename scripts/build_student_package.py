from __future__ import annotations

import shutil
import sys
import zipfile
from datetime import datetime
from pathlib import Path


STUDENT_MD_TARGETS = [
    "01_\u5b89\u88c5\u73af\u5883\u8981\u6c42.md",
    "02_OpenClaw\u5b89\u88c5\u4e0e\u542f\u52a8.md",
    "03_OpenClaw\u914d\u7f6e\u8bf4\u660e.md",
    "04_\u98de\u4e66\u63a5\u5165\u914d\u7f6e\u4e0e\u8054\u8c03.md",
    "05_\u591a\u6a21\u6001\u6a21\u578b\u63a5\u5165\u8bf4\u660e.md",
]


def write_utf8_sig(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8-sig", newline="\r\n")


def clean_path(path: Path) -> None:
    if path.is_dir():
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()


def copy_first_existing(target_path: Path, *candidates: Path) -> None:
    for candidate in candidates:
        if candidate.exists():
            shutil.copyfile(candidate, target_path)
            return


def copy_docs(source_dir: Path, destination_dir: Path) -> None:
    md_files = sorted(source_dir.glob("*.md"), key=lambda p: p.name)
    if len(md_files) != len(STUDENT_MD_TARGETS):
        raise RuntimeError("Markdown file count mismatch.")

    for src, target_name in zip(md_files, STUDENT_MD_TARGETS):
        shutil.copyfile(src, destination_dir / target_name)

    html_files = sorted(source_dir.glob("*.html"), key=lambda p: p.name)
    if html_files:
        shutil.copyfile(html_files[0], destination_dir / "\u98de\u4e66\u57f9\u8bad\u8d44\u6599.html")

    txt_files = sorted(source_dir.glob("*.txt"), key=lambda p: p.name)
    if len(txt_files) < 2:
        raise RuntimeError("TXT file count mismatch.")

    shutil.copyfile(txt_files[0], destination_dir / "\u5b66\u5458\u4f7f\u7528\u8bf4\u660e.txt")
    shutil.copyfile(txt_files[1], destination_dir / "\u5fae\u4fe1\u7fa4\u8bf4\u660e_\u5b66\u5458\u7248.txt")


def copy_config(source_dir: Path, destination_dir: Path) -> None:
    json_files = sorted(source_dir.glob("*.json5"), key=lambda p: p.name)
    if not json_files:
        raise RuntimeError("Model template not found.")

    shutil.copyfile(json_files[0], destination_dir / "\u56fd\u5185\u6a21\u578b\u914d\u7f6e\u6a21\u677f.json5")


def build_package() -> tuple[Path, Path]:
    root = Path(__file__).resolve().parents[1]
    packages_root = root / "packages"
    package_name = f"OpenClaw\u5b66\u5458\u5c01\u88c5\u5305_{datetime.now():%Y%m%d}"
    package_dir = packages_root / package_name
    zip_path = packages_root / f"{package_name}.zip"
    docs_dir = package_dir / "\u5b66\u4e60\u6587\u6863"
    config_dir = package_dir / "\u914d\u7f6e\u6a21\u677f"

    packages_root.mkdir(parents=True, exist_ok=True)
    clean_path(package_dir)
    clean_path(zip_path)

    docs_dir.mkdir(parents=True, exist_ok=True)
    config_dir.mkdir(parents=True, exist_ok=True)

    shutil.copyfile(root / "openclaw_quickstart.ps1", package_dir / "OpenClaw\u5feb\u901f\u542f\u52a8.ps1")
    shutil.copyfile(root / "openclaw_feishu_check.ps1", package_dir / "\u98de\u4e66\u8054\u8c03\u81ea\u68c0.ps1")

    copy_docs(root / "docs" / "training", docs_dir)
    copy_config(root / "config", config_dir)

    copy_first_existing(
        package_dir / "OpenClaw\u56fe\u6807.ico",
        root / "OpenClaw_Crayfish_Icon.ico",
        root / "assets" / "OpenClaw_Crayfish_Icon.ico",
    )
    copy_first_existing(
        package_dir / "\u5b66\u5458\u5c01\u88c5\u5305\u5c01\u9762.png",
        root / "OpenClaw_Student_Package_Cover.png",
        root / "assets" / "OpenClaw_Student_Package_Cover.png",
    )

    write_utf8_sig(
        package_dir / "\u4e00\u952e\u542f\u52a8.bat",
        """@echo off
chcp 65001 >nul
set \"ROOT=%~dp0\"
cd /d \"%ROOT%\"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File \"%ROOT%OpenClaw\u5feb\u901f\u542f\u52a8.ps1\"
""",
    )
    write_utf8_sig(
        package_dir / "\u517c\u5bb9\u6a21\u5f0f\u542f\u52a8.bat",
        """@echo off
chcp 65001 >nul
set \"ROOT=%~dp0\"
cd /d \"%ROOT%\"
call \"%ROOT%\u4e00\u952e\u542f\u52a8.bat\"
""",
    )
    write_utf8_sig(
        package_dir / "\u98de\u4e66\u8054\u8c03\u81ea\u68c0.bat",
        """@echo off
chcp 65001 >nul
set \"ROOT=%~dp0\"
cd /d \"%ROOT%\"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File \"%ROOT%\u98de\u4e66\u8054\u8c03\u81ea\u68c0.ps1\"
set \"EXIT_CODE=%ERRORLEVEL%\"
if not \"%EXIT_CODE%\"==\"0\" (
  echo.
  echo \u81ea\u68c0\u672a\u901a\u8fc7\uff0c\u8bf7\u6839\u636e\u4e0a\u9762\u7684\u63d0\u793a\u5148\u4fee\u590d\u73af\u5883\u3002
)
pause
exit /b %EXIT_CODE%
""",
    )
    write_utf8_sig(
        package_dir / "01_\u5148\u770b\u8fd9\u91cc.txt",
        """OpenClaw \u5b66\u5458\u5c01\u88c5\u5305\uff08\u5efa\u8bae\u5148\u770b\u672c\u6587\u4ef6\uff09

\u4f60\u6700\u5e38\u7528\u7684\u5165\u53e3\u53ea\u6709 2 \u4e2a\uff1a
1. `\u4e00\u952e\u542f\u52a8.bat`
2. `\u98de\u4e66\u8054\u8c03\u81ea\u68c0.bat`

\u63a8\u8350\u4e0a\u624b\u987a\u5e8f\uff1a
1. \u53cc\u51fb `\u4e00\u952e\u542f\u52a8.bat`
2. \u7b49\u5f85\u6d4f\u89c8\u5668\u6253\u5f00 `http://127.0.0.1:18789/`
3. \u5982\u679c\u542f\u52a8\u5931\u8d25\uff0c\u518d\u8fd0\u884c `\u98de\u4e66\u8054\u8c03\u81ea\u68c0.bat`
4. \u7136\u540e\u6309 `\u5b66\u4e60\u6587\u6863` \u91cc\u7684\u987a\u5e8f\u7ee7\u7eed\u914d\u7f6e

\u76ee\u5f55\u8bf4\u660e\uff1a
- `\u5b66\u4e60\u6587\u6863`\uff1a\u57f9\u8bad\u6587\u6863\u4e0e\u64cd\u4f5c\u8bf4\u660e
- `\u914d\u7f6e\u6a21\u677f`\uff1a\u6a21\u578b\u914d\u7f6e\u6a21\u677f
- `OpenClaw\u5feb\u901f\u542f\u52a8.ps1`\uff1a\u542f\u52a8\u811a\u672c\uff0c\u8bf7\u4e0d\u8981\u624b\u6539
- `\u98de\u4e66\u8054\u8c03\u81ea\u68c0.ps1`\uff1a\u98de\u4e66\u8054\u8c03\u81ea\u68c0\u811a\u672c
""",
    )
    write_utf8_sig(
        package_dir / "02_\u63a8\u8350\u64cd\u4f5c\u987a\u5e8f.txt",
        """\u63a8\u8350\u64cd\u4f5c\u987a\u5e8f

1. \u5148\u8fd0\u884c `\u4e00\u952e\u542f\u52a8.bat`
2. \u518d\u9605\u8bfb `\u5b66\u4e60\u6587\u6863\\01_\u5b89\u88c5\u73af\u5883\u8981\u6c42.md`
3. \u7136\u540e\u9605\u8bfb `\u5b66\u4e60\u6587\u6863\\02_OpenClaw\u5b89\u88c5\u4e0e\u542f\u52a8.md`
4. \u5982\u679c\u8981\u63a5\u98de\u4e66\uff0c\u7ee7\u7eed\u770b `\u5b66\u4e60\u6587\u6863\\04_\u98de\u4e66\u63a5\u5165\u914d\u7f6e\u4e0e\u8054\u8c03.md`
5. \u9047\u5230\u95ee\u9898\u65f6\uff0c\u8fd0\u884c `\u98de\u4e66\u8054\u8c03\u81ea\u68c0.bat`
""",
    )
    write_utf8_sig(
        docs_dir / "00_\u6587\u6863\u5bfc\u822a.txt",
        """OpenClaw \u6587\u6863\u5bfc\u822a

\u5efa\u8bae\u6309\u4e0b\u9762\u987a\u5e8f\u9605\u8bfb\uff1a
1. `01_\u5b89\u88c5\u73af\u5883\u8981\u6c42.md`
2. `02_OpenClaw\u5b89\u88c5\u4e0e\u542f\u52a8.md`
3. `03_OpenClaw\u914d\u7f6e\u8bf4\u660e.md`
4. `04_\u98de\u4e66\u63a5\u5165\u914d\u7f6e\u4e0e\u8054\u8c03.md`
5. `05_\u591a\u6a21\u6001\u6a21\u578b\u63a5\u5165\u8bf4\u660e.md`

\u8865\u5145\u6750\u6599\uff1a
- `\u98de\u4e66\u57f9\u8bad\u8d44\u6599.html`
- `\u5b66\u5458\u4f7f\u7528\u8bf4\u660e.txt`
- `\u5fae\u4fe1\u7fa4\u8bf4\u660e_\u5b66\u5458\u7248.txt`
""",
    )

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(package_dir.rglob("*")):
            zf.write(path, path.relative_to(package_dir))

    return package_dir, zip_path


def main() -> int:
    package_dir, zip_path = build_package()
    print(f"Built package: {package_dir}")
    print(f"Built zip: {zip_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
