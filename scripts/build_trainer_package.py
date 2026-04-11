from __future__ import annotations

import shutil
import sys
import zipfile
from datetime import datetime
from pathlib import Path


TRAINER_MD_TARGETS = [
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
    if len(md_files) != len(TRAINER_MD_TARGETS):
        raise RuntimeError("Markdown file count mismatch.")

    for src, target_name in zip(md_files, TRAINER_MD_TARGETS):
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
    for src in sorted(source_dir.iterdir(), key=lambda p: p.name):
        if src.is_file():
            shutil.copyfile(src, destination_dir / src.name)

    json_files = sorted(source_dir.glob("*.json5"), key=lambda p: p.name)
    if json_files:
        shutil.copyfile(json_files[0], destination_dir / "openclaw_model_template.json5")


def build_package() -> tuple[Path, Path]:
    root = Path(__file__).resolve().parents[1]
    packages_root = root / "packages"
    package_name = f"OpenClaw\u8bb2\u5e08\u5c01\u88c5\u5305_{datetime.now():%Y%m%d}"
    package_dir = packages_root / package_name
    zip_path = packages_root / f"{package_name}.zip"
    docs_dir = package_dir / "\u8bb2\u5e08\u6587\u6863"
    config_dir = package_dir / "\u914d\u7f6e\u6a21\u677f"

    packages_root.mkdir(parents=True, exist_ok=True)
    clean_path(package_dir)
    clean_path(zip_path)

    docs_dir.mkdir(parents=True, exist_ok=True)
    config_dir.mkdir(parents=True, exist_ok=True)

    shutil.copyfile(root / "OpenClaw_Console.bat", package_dir / "OpenClaw\u63a7\u5236\u53f0.bat")
    shutil.copyfile(root / "openclaw_console.ps1", package_dir / "OpenClaw\u63a7\u5236\u53f0.ps1")
    shutil.copyfile(root / "\u4e00\u952e\u542f\u52a8.bat", package_dir / "\u4e00\u952e\u542f\u52a8.bat")
    shutil.copyfile(root / "Start_OpenClaw.bat", package_dir / "\u517c\u5bb9\u6a21\u5f0f\u542f\u52a8.bat")
    shutil.copyfile(root / "openclaw_quickstart.ps1", package_dir / "OpenClaw\u5feb\u901f\u542f\u52a8.ps1")
    shutil.copyfile(root / "openclaw_feishu_check.ps1", package_dir / "\u98de\u4e66\u8054\u8c03\u81ea\u68c0.ps1")
    shutil.copyfile(root / "docs" / "training" / "openclaw-feishu-training.html", package_dir / "openclaw-feishu-training.html")
    shutil.copyfile(root / "docs" / "training" / "openclaw-feishu-training.html", package_dir / "\u98de\u4e66\u57f9\u8bad\u8d44\u6599.html")

    copy_docs(root / "docs" / "training", docs_dir)
    copy_config(root / "config", config_dir)

    copy_first_existing(
        package_dir / "\u8bb2\u5e08\u5c01\u88c5\u5305\u5c01\u9762.png",
        root / "OpenClaw_Student_Package_Cover.png",
        root / "assets" / "OpenClaw_Student_Package_Cover.png",
    )
    copy_first_existing(
        package_dir / "OpenClaw\u56fe\u6807.ico",
        root / "OpenClaw_Crayfish_Icon.ico",
        root / "assets" / "OpenClaw_Crayfish_Icon.ico",
    )

    write_utf8_sig(
        package_dir / "\u542f\u52a8\u7ba1\u7406\u5668.bat",
        """@echo off
chcp 65001 >nul
set \"ROOT=%~dp0\"
cd /d \"%ROOT%\"
call \"%ROOT%OpenClaw\u63a7\u5236\u53f0.bat\"
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
        package_dir / "\u6253\u5f00\u57f9\u8bad\u8bfe\u4ef6.bat",
        """@echo off
chcp 65001 >nul
set \"ROOT=%~dp0\"
cd /d \"%ROOT%\"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File \"%ROOT%open_training_courseware.ps1\"
""",
    )
    write_utf8_sig(
        package_dir / "open_training_courseware.ps1",
        """$ErrorActionPreference = \"Stop\"
$port = 8019
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$courseUrl = \"http://127.0.0.1:$port/openclaw-feishu-training.html\"

function Test-CourseServerRunning {
  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq \"Listen\" -and $_.OwningProcess -gt 0 }
  return $null -ne $connections
}

if (-not (Test-CourseServerRunning)) {
  Start-Process powershell -ArgumentList @(
    \"-NoLogo\",
    \"-NoProfile\",
    \"-ExecutionPolicy\", \"Bypass\",
    \"-File\", (Join-Path $root \"courseware_local_server.ps1\"),
    \"-RootPath\", $root,
    \"-Port\", \"$port\"
  )
  Start-Sleep -Seconds 2
}

Start-Process $courseUrl
""",
    )
    write_utf8_sig(
        package_dir / "courseware_local_server.ps1",
        """param(
  [Parameter(Mandatory = $true)]
  [string]$RootPath,
  [int]$Port = 8019
)

$ErrorActionPreference = \"Stop\"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add(\"http://127.0.0.1:$Port/\")
$listener.Start()

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = \"openclaw-feishu-training.html\"
    }

    $filePath = Join-Path $RootPath $requestPath
    if (Test-Path $filePath -PathType Leaf) {
      $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $contentType = switch ($extension) {
        \".html\" { \"text/html; charset=utf-8\" }
        \".txt\" { \"text/plain; charset=utf-8\" }
        \".md\" { \"text/plain; charset=utf-8\" }
        \".json5\" { \"application/json; charset=utf-8\" }
        \".png\" { \"image/png\" }
        \".ico\" { \"image/x-icon\" }
        default { \"application/octet-stream\" }
      }

      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $context.Response.StatusCode = 200
      $context.Response.ContentType = $contentType
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $notFound = [System.Text.Encoding]::UTF8.GetBytes(\"Not Found\")
      $context.Response.StatusCode = 404
      $context.Response.ContentType = \"text/plain; charset=utf-8\"
      $context.Response.ContentLength64 = $notFound.Length
      $context.Response.OutputStream.Write($notFound, 0, $notFound.Length)
    }

    $context.Response.OutputStream.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
""",
    )
    write_utf8_sig(
        package_dir / "01_\u8bb2\u5e08\u5148\u770b\u8fd9\u91cc.txt",
        """OpenClaw \u8bb2\u5e08\u5c01\u88c5\u5305\uff08\u5efa\u8bae\u5148\u770b\u672c\u6587\u4ef6\uff09

\u63a8\u8350\u5165\u53e3\uff1a
1. `\u542f\u52a8\u7ba1\u7406\u5668.bat`
2. `OpenClaw\u63a7\u5236\u53f0.bat`
3. `\u98de\u4e66\u8054\u8c03\u81ea\u68c0.bat`
4. `\u6253\u5f00\u57f9\u8bad\u8bfe\u4ef6.bat`

\u63a8\u8350\u5de5\u4f5c\u6d41\uff1a
1. \u5148\u7528 `\u542f\u52a8\u7ba1\u7406\u5668.bat` \u8fdb\u5165\u63a7\u5236\u83dc\u5355
2. \u9700\u8981\u5feb\u901f\u542f\u52a8\u65f6\uff0c\u4e5f\u53ef\u4ee5\u76f4\u63a5\u8fd0\u884c `\u4e00\u952e\u542f\u52a8.bat`
3. \u8054\u8c03\u98de\u4e66\u524d\uff0c\u5148\u8dd1 `\u98de\u4e66\u8054\u8c03\u81ea\u68c0.bat`
4. \u8bb2\u8bfe\u65f6\u53ef\u76f4\u63a5\u8fd0\u884c `\u6253\u5f00\u57f9\u8bad\u8bfe\u4ef6.bat`
5. \u8bb2\u89e3\u65f6\u914d\u5408 `\u8bb2\u5e08\u6587\u6863` \u4f7f\u7528

\u76ee\u5f55\u8bf4\u660e\uff1a
- `\u8bb2\u5e08\u6587\u6863`\uff1a\u57f9\u8bad\u6587\u6863\u4e0e\u8bb2\u89e3\u7d20\u6750
- `\u914d\u7f6e\u6a21\u677f`\uff1a\u914d\u7f6e\u6a21\u677f
- `OpenClaw\u63a7\u5236\u53f0.ps1`\uff1a\u63a7\u5236\u53f0\u811a\u672c
- `OpenClaw\u5feb\u901f\u542f\u52a8.ps1`\uff1a\u5feb\u901f\u542f\u52a8\u811a\u672c
- `openclaw-feishu-training.html`\uff1a\u8bfe\u4ef6\u6587\u4ef6
""",
    )
    write_utf8_sig(
        package_dir / "02_\u8bb2\u5e08\u5f00\u573a3\u5206\u949f\u64cd\u4f5c\u6e05\u5355.txt",
        """OpenClaw \u8bb2\u5e08\u5f00\u573a 3 \u5206\u949f\u64cd\u4f5c\u6e05\u5355

1. \u5148\u786e\u8ba4\u5df2\u7ecf\u89e3\u538b\u8bb2\u5e08\u5305\uff0c\u76ee\u5f55\u91cc\u53ef\u4ee5\u770b\u5230\uff1a
- `\u542f\u52a8\u7ba1\u7406\u5668.bat`
- `OpenClaw\u63a7\u5236\u53f0.bat`
- `\u6253\u5f00\u57f9\u8bad\u8bfe\u4ef6.bat`

2. \u53cc\u51fb `\u542f\u52a8\u7ba1\u7406\u5668.bat`\uff0c\u5148\u68c0\u67e5 Gateway \u72b6\u6001\u3002

3. \u5982\u679c\u9700\u8981\u5feb\u901f\u5f00\u8bb2\uff0c\u53ef\u76f4\u63a5\u8fd0\u884c\uff1a
- `\u4e00\u952e\u542f\u52a8.bat`

4. \u542f\u52a8\u6210\u529f\u540e\uff0c\u5728\u6d4f\u89c8\u5668\u786e\u8ba4\uff1a
- `http://127.0.0.1:18789/` \u80fd\u6b63\u5e38\u6253\u5f00
- Dashboard \u9875\u9762\u6ca1\u6709\u963b\u65ad\u62a5\u9519

5. \u6b63\u5f0f\u5f00\u8bb2\u524d\uff0c\u53cc\u51fb `\u6253\u5f00\u57f9\u8bad\u8bfe\u4ef6.bat`\u3002

6. \u5982\u679c\u8981\u73b0\u573a\u6f14\u793a\u98de\u4e66\u8054\u8c03\uff0c\u5148\u8fd0\u884c\uff1a
- `\u98de\u4e66\u8054\u8c03\u81ea\u68c0.bat`

7. \u73b0\u573a\u5907\u7528\u53e3\u4ee4\uff1a
- `openclaw gateway status`
- `openclaw gateway stop`
- `openclaw gateway --port 18789 --verbose`
- `openclaw logs --follow`

8. \u5982\u679c\u5b66\u5458\u63d0\u95ee\u201c\u4e3a\u4ec0\u4e48\u542f\u52a8\u5931\u8d25\u201d\uff0c\u4f18\u5148\u68c0\u67e5\uff1a
- Node.js \u662f\u5426 >= 22
- \u662f\u5426\u80fd\u8bbf\u95ee npm
- \u662f\u5426\u8fd0\u884c\u4e86 `\u98de\u4e66\u8054\u8c03\u81ea\u68c0.bat`
""",
    )
    write_utf8_sig(
        package_dir / "README_START_HERE.txt",
        """OpenClaw Trainer Package

Recommended:
1. Double-click `\u542f\u52a8\u7ba1\u7406\u5668.bat`
2. Use `OpenClaw\u63a7\u5236\u53f0.bat` for gateway control and troubleshooting
3. Run `\u98de\u4e66\u8054\u8c03\u81ea\u68c0.bat` before Feishu demo or training
4. Run `\u6253\u5f00\u57f9\u8bad\u8bfe\u4ef6.bat` for training slides
""",
    )
    write_utf8_sig(
        docs_dir / "00_\u6587\u6863\u5bfc\u822a.txt",
        """OpenClaw \u6587\u6863\u5bfc\u822a

\u8bb2\u5e08\u5efa\u8bae\u6309\u4e0b\u9762\u987a\u5e8f\u8bb2\u89e3\uff1a
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
