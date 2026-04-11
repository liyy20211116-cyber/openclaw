---
name: libreoffice-safe-export
description: "将固定 inbox 目录内的 Office 文件安全导出为 PDF。仅用于 DOC/DOCX/PPT/PPTX/XLS/XLSX/ODT/ODS/ODP/RTF/TXT -> PDF，不用于任意文件编辑、任意路径访问或自由执行 LibreOffice。"
metadata: { "openclaw": { "emoji": "📄", "os": ["win32"], "requires": { "anyBins": ["powershell", "pwsh"] } } }
---

# LibreOffice Safe Export

这个 Skill 只做一件事：

- 把 `D:\FY003\workspace\libreoffice_safe\inbox` 目录中的允许类型文件导出为 PDF
- 输出固定落到 `D:\FY003\workspace\libreoffice_safe\pdf`

## 何时使用

当用户明确要求以下任务时使用：

- 把 Word 文档转成 PDF
- 把 PPT 转成 PDF
- 把 Excel / ODT / ODS / ODP / RTF / TXT 导出成 PDF
- 飞书里上传了办公文件，用户要一个 PDF 版本

## 不要使用本 Skill 的情况

- 用户要求直接修改 Word/PPT 内容
- 用户要求访问任意磁盘路径
- 用户要求批量扫描全盘文档
- 用户要求运行 LibreOffice 的其他功能
- 文件不在固定 inbox 目录里

## 安全边界

必须严格遵守：

1. 只允许读取 `D:\FY003\workspace\libreoffice_safe\inbox` 下的文件
2. 只允许输出到 `D:\FY003\workspace\libreoffice_safe\pdf`
3. 不要拼接或执行来自用户输入的任意 PowerShell 命令
4. 不要把完整文档内容发给外部模型；仅可在必要时汇报文件名、导出结果、输出路径、大小
5. 如果文件不在 inbox 目录，先让用户把文件放到该目录，再继续

## 允许的文件类型

- `.doc`
- `.docx`
- `.odt`
- `.rtf`
- `.txt`
- `.ppt`
- `.pptx`
- `.odp`
- `.xls`
- `.xlsx`
- `.ods`

## 执行方式

使用 shell 运行固定脚本：

```powershell
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "D:\FY003\scripts\libreoffice_safe_export.ps1" -SourcePath "D:\FY003\workspace\libreoffice_safe\inbox\example.docx"
```

如需指定输出文件名（不含扩展名）：

```powershell
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "D:\FY003\scripts\libreoffice_safe_export.ps1" -SourcePath "D:\FY003\workspace\libreoffice_safe\inbox\example.docx" -OutputStem "example_export"
```

如需覆盖同名 PDF：

```powershell
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "D:\FY003\scripts\libreoffice_safe_export.ps1" -SourcePath "D:\FY003\workspace\libreoffice_safe\inbox\example.docx" -Overwrite
```

## 返回结果处理

脚本会输出 JSON。你需要：

- 若 `ok` 为 `true`：告诉用户 PDF 已生成，并返回 `output` 路径与文件大小
- 若 `ok` 为 `false`：转述 `message`，并根据 `code` 给出下一步建议

常见失败码：

- `soffice_not_found`：未安装 LibreOffice
- `source_not_found`：源文件不存在
- `source_outside_inbox`：文件不在固定 inbox 内
- `unsupported_extension`：扩展名不被允许
- `target_exists`：目标文件已存在
- `convert_failed`：LibreOffice 执行失败
- `pdf_missing`：转换结束但没有 PDF 产物

## 对用户的回复要求

默认只回复：

- 是否成功
- 生成后的 PDF 路径
- 文件大小
- 如失败则给出简洁可执行建议

不要主动暴露内部脚本细节，除非用户明确追问。
