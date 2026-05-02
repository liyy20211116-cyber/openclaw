# Operation "First Blood" · 一人公司 AI 军团 30 天启航冲刺

> 启动日：2026-04-22
> 指挥官：贾维斯（COO）
> 作战周期：Day 1 ~ Day 30（首轮）
> 核心目标：**首笔 ≥ ¥999 真实订单**，90 天月流水 ¥20,000

---

## 一、战略定位

```
用 Jarvis OS 先让自己（碳基 CEO）赚到钱
        ↓
产生真实营收案例 + 月流水截图 + Token 工资单
        ↓
打包成「Jarvis OS + 跑通模板」商品（¥999 / ¥2,999 / ¥9,999 三档）
        ↓
卖给下一个一人公司
        ↓
新客户复制我的路径 → 产品口碑飞轮
```

## 二、三箭并行（D3=D 三路同时开）

| 箭 | 目标 | 负责团队 | 里程碑 |
|---|---|---|---|
| 🏹 内容 IP 起量 | Day 30 粉丝 1k | pack-content-factory 5 虾阵 + Luna | Day 7 首条 ≥500 播放 |
| 🏹 服务咨询接单 | Day 14 首单 ¥999+ | Fred-sales + Dobby + Mcgonagall | Day 14 签约首位付费客户 |
| 🏹 训练营规模化 | Day 60 30 人 | Luna + Mcgonagall + 碳基 CEO | Day 30 招生开启 |

## 三、七大工作包

### WP1 · 配置中心 M1 骨架 ✅ 已完成

- `config/tenant/default/` 6 个 JSON（tenant / branding / commerce / features / token-economy / integrations/README）
- `config/schemas/` 5 个 JSON Schema
- `config/README.md` 总说明

### WP2 · Landing Page + 三档定价页 ✅ 已完成

- `docs/landing/pricing.html` 全新定价页（启航 ¥999 / 标准 ¥2,999 / 企业 ¥9,999 + 训练营 ¥999）
- 含 5 大核心统计 / 功能对比表 / 7 条 FAQ

### WP3 · 许可证发放器 ✅ 已完成

- `scripts/license/issue.py` — 单发 / 批量 / 列表 / 校验 一体化
- `scripts/license/verify.py` — 客户端校验（供桌面端调用）
- 格式：`JSV1-<payload_b64>-<sig_b64>`，HMAC-SHA256 签名，无需服务器

### WP4 · 首批 10 条抖音脚本 🟡 待生产

- 选题虾基于 Day 1 的 mock 热榜选 10 条
- 首条建议：「我给 AI 员工发工资，它们靠绩效吃饭」（Token 工资单视角）
- 预计 Day 3 交付全部 10 条脚本

### WP5 · 作战站会 / 复盘脚本 🟡 待开发

- `scripts/operation_standup.py` 每日 9 点跑
- `scripts/weekly_retro.py` 每周日跑

### WP6 · 销售话术 + 服务 SOP 🟡 待开发

- `docs/sales/pitch-3-levels.md`
- `docs/sales/onboarding-sop.md`

### WP7 · 4 月 Token 工资单海报 🟡 待执行

- 运行 `python scripts/generate_salary_poster.py`
- 作为首条抖音/小红书内容素材

---

## 四、CEO 本周必做 5 件事

1. **Day 1** 批准本作战令 ✅
2. **Day 2** 注册 4 个平台账号并填入 `config/tenant/default/integrations/`
   - 抖音：`integrations/douyin.json`
   - 小红书：`integrations/xiaohongshu.json`
   - B站：`integrations/bilibili.json`
   - 公众号：`integrations/wechat-official.json`
3. **Day 3** 收款信息：
   - 把支付宝/微信收款码图片放到 `assets/qr/`
   - 填写 `config/tenant/default/commerce.json` 的 `personal_qr` 字段，并把 `enabled` 改为 true
4. **Day 5** 录 1 条 30 秒开场白视频（若不方便出镜，告诉我，改用全 AI TTS + 动态字幕）
5. **Day 7** 与我一起复盘首周（`scripts/weekly_retro.py` 自动拉数据）

## 五、KPI 仪表盘

| 指标 | Day 7 | Day 14 | Day 30 | 负责 |
|---|---|---|---|---|
| 4 平台粉丝合计 | 50 | 300 | 1,000 | Luna |
| 发布视频数 | 5 | 15 | 30 | 内容工厂 |
| Landing Page UV | 100 | 500 | 2,000 | Luna |
| 首笔订单 ¥ | 0 | ¥999 | ¥2,999 | Fred |
| 客户咨询数 | 3 | 15 | 50 | Dobby |
| 配置中心完成度 | M1 | M2 部分 | M2 完整 | Hermione |
| Token 工资单 | 本月首发 | — | 下月发 | Percy |

## 六、风险台账（每日由 Snape 扫）

| 风险 | 触发 | 预案 |
|---|---|---|
| 抖音限流 | 首条 <500 播放 | 切换"AI 工资单"猎奇视角 |
| Claude CLI 被封 | videocut 失败 | 切换 GLM-4.6 / Kimi K2 |
| 微信 wxauto 异常 | 连续 3 次掉线 | 降级飞书通知 |
| 无人咨询 | Day 14 仍 0 单 | 启动训练营预售 |
| 收款失败 | 个人码限额 | 激活对公收款 + 电子发票 |

## 七、需要 CEO 提供的清单（汇总）

### 🔥 Day 2 必须
- [ ] 抖音账号昵称 + 登录手机（建议：「Jarvis一人公司OS」）
- [ ] 小红书账号昵称 + 登录手机
- [ ] B站账号 UID + 登录邮箱
- [ ] 公众号名称 + AppID + AppSecret（可选）

### 🔥 Day 3 必须
- [ ] 支付宝收款码图片
- [ ] 微信收款码图片
- [ ] （可选）对公账户：公司名 / 账号 / 银行 / 税号

### 🔥 Day 5 必须
- [ ] CEO 姓名 + 30 字自我介绍
- [ ] 是否出镜（否则全 AI 生成）
- [ ] Logo（可要我 AI 生成）

### Day 7+ 可选
- [ ] GitHub 账号
- [ ] 域名（比如 jarvis-os.com）
- [ ] ICP 备案
- [ ] 诺诺/开票魔方 API（如需开票）

---

## 八、作战节奏

```
Day 1  作战令批准 + 配置中心 + Landing + 许可证（本批已交付）
Day 2  CEO 开账号 / Luna 写 10 条脚本
Day 3  首批发布 3 条内容 / 收款码就位
Day 4  Jarvis 全天跑 pipeline_koubo 批量出片
Day 5  CEO 录开场白 / 训练营招生页上线
Day 6  销售话术完成 / Dobby 首个客户咨询模拟
Day 7  复盘 + 调整下周方向
```

---

## 九、一句话作战目标

> **"30 天内，用 Jarvis OS 自己挣到 ¥1 元真实收入，证明它能赚钱；60 天内，卖出第一份 Jarvis OS 商品，证明它能被别人用来赚钱；90 天内，月流水 ¥20,000，证明它可以规模化。"**
