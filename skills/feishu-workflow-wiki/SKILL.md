---
name: feishu-workflow-wiki
description: "当用户要求把内容沉淀到飞书知识库、创建知识库页面、整理目录结构、归档流程文档时使用。先用 feishu_wiki 创建/定位节点，再用 feishu_doc 写正文。"
metadata: { "openclaw": { "emoji": "📚", "os": ["win32"] } }
---

# Feishu Workflow Wiki

用于把流程、制度、规范、知识沉淀进飞书知识库。

## 适用场景

- 帮我放到知识库
- 新建一个 wiki 页面
- 把 SOP 归档进知识库
- 帮我整理知识库目录
- 把文档沉淀成长期可维护页面

## 工具组合

1. `feishu_wiki` 用于找空间、找节点、建页面、移动页面
2. `feishu_doc` 用于写页面正文

## 标准流程

### 第一步：确定空间

如果用户没有提供 wiki 链接或空间信息，先列空间：

```json
{ "action": "spaces" }
```

### 第二步：创建页面

```json
{ "action": "create", "space_id": "7xxx", "title": "需求评审流程" }
```

如果用户要求建在某个父节点下面，则传 `parent_node_token`。

### 第三步：获取 node 对应的文档 token

```json
{ "action": "get", "token": "wiki_token" }
```

### 第四步：写入正文

```json
{ "action": "write", "doc_token": "obj_token", "content": "# 标题\n\n正文..." }
```

## 推荐页面结构

1. 页面简介
2. 使用范围
3. 标准流程
4. 角色职责
5. 常见问题
6. 相关文档链接

## 工作原则

- 优先沉淀长期复用的知识，而不是临时聊天内容
- 如果内容更适合知识库，而不是普通文档，应优先用本 skill
- 新页面命名要清晰、可检索、可维护

## 对外回复

完成后告诉用户：

- 已创建或更新知识库页面
- 页面标题
- 所在知识空间 / 父目录
- 是否已写入正文
