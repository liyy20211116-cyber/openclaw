# OpenClaw 配置说明

## 1. 配置方式

推荐优先使用交互命令配置，减少手工编辑错误：

```powershell
openclaw channels add
```

完成后执行：

```powershell
openclaw gateway restart
openclaw gateway status
```

## 2. 配置文件位置

- 文件：`C:\Users\<用户名>\.openclaw\openclaw.json`

## 3. 推荐最小配置（示例）

```json5
{
  channels: {
    feishu: {
      enabled: true,
      connectionMode: "websocket",
      dmPolicy: "pairing",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
          botName: "公司AI助手"
        }
      }
    }
  }
}
```

## 4. 国际版 Lark 补充（按需）

```json5
{
  channels: {
    feishu: {
      domain: "lark"
    }
  }
}
```

## 5. 配置生效检查

```powershell
openclaw gateway status
openclaw logs --follow
```

## 6. 验收清单

- [ ] 渠道已添加成功
- [ ] 网关可正常重启
- [ ] 状态命令返回正常
- [ ] 日志无持续错误
