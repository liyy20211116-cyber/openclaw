# OpenClaw 培训文档总入口

本目录已整理为培训最小闭环版本，按下面顺序学习和实操即可。

## 建议阅读与实操顺序

1. `01_安装环境要求.md`
2. `02_OpenClaw安装与启动.md`
3. `03_OpenClaw配置说明.md`
4. `04_飞书接入配置与联调.md`

## 启动入口

- `一键启动.bat`：学员使用，首次自动安装 OpenClaw，后续直接启动 Gateway
- `OpenClaw_Console.bat`：讲师/管理员使用，进入启动管理菜单
- `openclaw_quickstart.ps1`：`一键启动.bat` 调用的英文启动脚本
- `openclaw_console.ps1`：`OpenClaw_Console.bat` 调用的英文管理脚本
- `openclaw_feishu_check.ps1`：英文版飞书联调自检脚本

## 培训交付标准（最实用）

- 能成功启动 Gateway 并访问 `http://127.0.0.1:18789/`
- 能完成飞书渠道配置并收到测试消息
- 能使用日志命令定位常见问题
