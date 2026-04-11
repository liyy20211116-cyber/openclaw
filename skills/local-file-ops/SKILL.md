---
name: local-file-ops
description: "当需要读写本地文件、管理目录结构、调用本地软件（FFmpeg/LibreOffice/Python等）、处理文档转换时使用。"
metadata: { "openclaw": { "emoji": "📁", "os": ["win32"] } }
---

# Local File Ops — 本地文件与软件操作

所有角色共享的本地文件系统和软件调用能力。

## 适用场景

- 读取/写入/编辑本地文件（文本、JSON、CSV、Markdown）
- 创建/管理目录结构
- 调用本地安装的软件（FFmpeg、LibreOffice、Python 等）
- 文档格式转换（Markdown→PDF、DOCX→PDF 等）
- 文件搜索和批量处理
- 压缩/解压文件

## 可用工具

| 工具 | 用途 |
|------|------|
| `Read` / `Write` / `StrReplace` | 文件读写和精确编辑 |
| `Glob` | 按模式搜索文件 |
| `Grep` | 在文件内容中搜索 |
| `Shell` | 执行系统命令、调用本地软件 |
| `Delete` | 删除文件 |

## 本地软件调用

### Python

```powershell
python script.py --arg value
pip install package_name
```

### FFmpeg（视频/音频处理）

```powershell
ffmpeg -i input.mp4 -c:v libx264 output.mp4
ffmpeg -i video.mp4 -vn -acodec mp3 audio.mp3
```

### LibreOffice（文档转换）

```powershell
# 使用安全导出脚本
powershell -File scripts\libreoffice_safe_export.ps1
```

参考 `skills/libreoffice-safe-export/SKILL.md` 获取详细用法。

### Node.js / npm

```powershell
node script.js
npm install package_name
npx command
```

## 目录管理规范

```
d:\FY003\
├── output\          # 所有产出物统一存放
│   ├── reports\     # 报告
│   ├── articles\    # 文章
│   ├── proposals\   # 方案
│   ├── finance\     # 财务
│   ├── audit\       # 审计
│   ├── feedback\    # 反馈
│   ├── guides\      # 指南
│   ├── screenshots\ # 截图
│   └── temp\        # 临时文件
├── data_raw\        # 原始数据
├── data_clean\      # 清洗后数据
└── workspace\       # 工作区
```

## 各角色典型用法

| 角色 | 典型操作 |
|------|----------|
| 贾维斯 | 汇总各部门产出文件、生成整合报告 |
| 赫敏 | 编写/执行脚本、管理代码文件 |
| 卢娜 | 调用 FFmpeg 渲染视频、管理内容素材 |
| 珀西 | 生成 Excel/CSV 财务报表 |
| 斯内普 | 扫描文件安全隐患、检查日志文件 |

## 注意事项

- 写入前先确认目标目录存在
- 编辑文件优先用 StrReplace（精确替换），避免全量覆盖
- 删除操作不可逆，谨慎使用
- 大文件（>10MB）处理时注意内存
- 临时文件用完即删，保持工作区整洁
