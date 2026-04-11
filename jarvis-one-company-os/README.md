# Jarvis One Company OS

一个面向“一人公司”场景的本地业务操作台，当前包含 CEO 模板发起、任务写回、审批流转、资金与收益面板，以及面向桌面端收口的本地启动骨架。

## 当前能力

- CEO 模板可把任务草案直接送入任务页预填。
- 任务页支持写回创建任务，并根据是否需要审批自动流转。
- 审批页支持承接来自任务创建流的审批事项高亮。
- 审批通过后会回到任务页并高亮对应任务。
- 审批驳回后会回到任务页待修正流，并自动聚焦创建表单。
- 驳回回流现在会把标题、描述、负责人、类型、优先级、预算与截止日期完整带回表单。
- 修正后重新提交会直接更新原任务，并重新发起审批，而不是新增一条重复任务。
- 任务卡与审批卡会展示重提次数，以及最近一次驳回原因。
- 任务页右侧可查看完整审批轨迹，包括首次提交、重提、发起审批、通过/驳回时间线。
- 本地开发栈可同时启动前端与写回 API。
- 已预留 Electron / Tauri 两种桌面容器接入骨架。
- 已提供一个最小 Electron 联调入口用于后续桌面化收口。
- Electron 现在带有开发/生产加载切换、窗口状态持久化和加载失败兜底页。
- 已补可分发化的第一步准备：Electron 编译产物目录、打包脚本入口、Windows NSIS 配置和桌面图标资源。

## 本地启动

```bash
npm install
npm run dev
```

Windows 下也可以直接双击 `Start_Jarvis_One_Company_OS.bat`。

## 主要脚本

- `npm run dev`：启动完整本地开发栈。
- `npm run build`：执行 TypeScript 构建与前端打包。
- `npm run lint`：检查前端代码规范。
- `npm run db:writeback-api`：单独启动写回 API。
- `npm run desktop:guide`：输出当前桌面端接入骨架说明与依赖就绪状态。
- `npm run desktop:start`：启动开发态 Electron 联调入口。
- `npm run desktop:build`：构建前端产物与 Electron 主进程产物，供桌面生产态加载。
- `npm run desktop:prod`：以生产态资源启动 Electron。
- `npm run desktop:package`：执行桌面打包流程，目标为 Windows NSIS 安装包。

## 桌面端收口骨架

当前仓库已补齐以下结构：

- `desktop/electron/main.ts`：Electron 主进程入口骨架，已补窗口生命周期、开发/生产加载切换、状态持久化与失败兜底。
- `desktop/electron/preload.ts`：Electron preload 预留桥接层，暴露当前桌面模式与运行环境。
- `desktop/electron/package.json`：打包时用于指向 Electron 编译产物入口。
- `desktop/electron/fallback.html`：开发地址或生产资源加载失败时的兜底页。
- `desktop/tauri/tauri.conf.json`：Tauri v2 配置预留。
- `build/icon.svg`：桌面图标基础资源，可继续扩展为 `.ico` / `.icns`。
- `scripts/desktop-entry.ts`：统一输出桌面端接入提示、依赖状态与产物状态。
- `scripts/desktop-dev.ts`：同时拉起前端、写回 API、wait-on 和 Electron 的联调脚本。
- `scripts/desktop-prod.ts`：以生产态模式启动 Electron，并验证 dist 产物是否存在。
- `scripts/desktop-package.ts`：执行构建 + Electron Builder 打包流程。
- `tsconfig.electron.json`：单独编译 Electron 主进程与 preload 到 `dist-electron/`。

## 说明

这一步已经不是纯占位目录，而是把最小桌面联调链路也接上了：开发态可直接从工程脚本或 bat 入口拉起 Electron；生产态可加载 dist 产物；如果本地页面或构建资源未就绪，也会显示兜底页而不是白屏。现在也已开始为正式分发做准备，但当前环境安装 `electron-builder` 时遇到网络错误（`github.com` 解析失败），因此 `desktop:package` 脚本和 NSIS 配置已经就位，真正打包仍需待依赖安装成功后完成。Tauri 仍保留为下一阶段的原生壳方向。
