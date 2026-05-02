# Jarvis OS 环境检查报告

> 生成于 2026-04-22 16:17:17

- 操作系统：Windows 11
- Python：3.13.13

## 命令行工具

| 工具 | 状态 | 版本 |
|---|:---:|---|
| git | ✅ | git version 2.52.0.windows.1 |
| node | ✅ | v22.22.2 |
| npm | ✅ | error: [WinError 2] 系统找不到指定的文件。 |
| python | ✅ | Python 3.13.13 |
| ffmpeg | ✅ | ffmpeg version 8.0.1-full_build-www.gyan.dev Copyright (c) 2000-2025 the FFmpeg developers |
| uv | ✅ | uv 0.10.8 (c021be36a 2026-03-03) |
| opencli | ❌ | - |
| claude | ❌ | - |

## Python 包

| 包 | 状态 | 版本 |
|---|:---:|---|
| pillow | ❌ | - |
| requests | ✅ | 2.32.3 |
| wxauto | ❌ | - |
| edge_tts | ❌ | - |
| whisper | ❌ | - |

## 外部开源工具链

| 路径 | 上游 | 存在 | 有 SKILL.md |
|---|---|:---:|:---:|
| `tools/videocut` | zinan92/videocut | ✅ | ✅ |
| `tools/openclip` | linzzzzzz/openclip | ✅ | — |
| `tools/Clip2Post` | WtecHtec/Clip2Post | ✅ | — |
| `tools/OpenCLI` | jackwener/opencli | ✅ | — |

## 修复建议

- 缺少命令行：opencli, claude
- 缺少 Python 包：`pip install pillow wxauto edge_tts whisper`
