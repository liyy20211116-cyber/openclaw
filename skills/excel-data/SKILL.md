---
name: excel-data
description: "当需要创建/读取/编辑 Excel 表格、进行数据处理和分析、生成财务报表、制作数据表单时使用。"
metadata: { "openclaw": { "emoji": "📊", "os": ["win32"] } }
---

# Excel Data — Excel 数据处理

所有角色共享的 Excel 电子表格操作能力。

## 适用场景

- 创建和编辑 Excel 文件
- 数据汇总、统计、分析
- 生成财务报表和预算表
- 制作客户数据表和 CRM 表
- 批量数据导入导出
- 数据可视化（表格内图表）

## 可用工具

| 工具 | 用途 |
|------|------|
| `excel_read_sheet` | 读取 Excel 表格数据 |
| `excel_write_to_sheet` | 写入数据到表格 |
| `excel_format_range` | 设置单元格格式和样式 |
| `excel_create_table` | 创建表格对象 |
| `excel_describe_sheets` | 查看工作簿结构 |
| `excel_copy_sheet` | 复制工作表 |

## 常用操作

### 创建新表格

```json
{
  "fileAbsolutePath": "d:\\FY003\\output\\finance\\report.xlsx",
  "sheetName": "月度报表",
  "newSheet": true,
  "range": "A1:D1",
  "values": [["部门", "预算", "实际", "偏差率"]]
}
```

### 写入数据

```json
{
  "fileAbsolutePath": "d:\\FY003\\output\\finance\\report.xlsx",
  "sheetName": "月度报表",
  "newSheet": false,
  "range": "A2:D4",
  "values": [
    ["技术部", 5000, 4800, "=-4%"],
    ["产品部", 2000, 2100, "=5%"],
    ["增长部", 3000, 2900, "=-3.3%"]
  ]
}
```

### 设置格式

表头加粗、填充颜色：
```json
{
  "range": "A1:D1",
  "styles": [[
    {"font": {"bold": true}, "fill": {"type": "pattern", "pattern": "solid", "color": ["#4472C4"]}},
    {"font": {"bold": true}, "fill": {"type": "pattern", "pattern": "solid", "color": ["#4472C4"]}},
    {"font": {"bold": true}, "fill": {"type": "pattern", "pattern": "solid", "color": ["#4472C4"]}},
    {"font": {"bold": true}, "fill": {"type": "pattern", "pattern": "solid", "color": ["#4472C4"]}}
  ]]
}
```

## 报表模板

### 财务日报
| 列 | 内容 |
|----|------|
| A | 日期 |
| B | 部门 |
| C | 消耗Token |
| D | 预算余额 |
| E | 偏差率 |
| F | 备注 |

### 销售漏斗
| 列 | 内容 |
|----|------|
| A | 客户名称 |
| B | 阶段 |
| C | 预期金额 |
| D | 成交概率 |
| E | 预计成交日 |
| F | 负责人 |

## 各角色典型用法

| 角色 | 场景 |
|------|------|
| 珀西 | Token 消耗报表、预算跟踪表、ROI 分析 |
| 弗雷德 | 客户管理表、报价单、销售漏斗表 |
| 贾维斯 | 项目进度跟踪表、资源分配表 |
| 斯内普 | 审计发现清单、风险登记表 |
| 卢娜 | 内容排期表、数据复盘表 |

## 文件管理

- Excel 文件统一存放在 `output/` 对应子目录
- 文件名格式：`{类型}_{日期}.xlsx`
- 重要报表保留历史版本
- 大型数据集（>10万行）优先用 CSV + Python pandas

## 注意事项

- 写入前先读取确认表结构，避免覆盖已有数据
- 公式使用 `=` 前缀
- 金额统一保留2位小数
- 百分比使用小数格式（0.05 表示 5%）
- 日期统一用 ISO 格式（YYYY-MM-DD）
