import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../../src/generated/prisma/client'

function resolveProjectRoot(): string {
  const companyDataDir = process.env.JARVIS_COMPANY_DATA_DIR
  if (companyDataDir && fs.existsSync(companyDataDir)) {
    return companyDataDir
  }

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const candidates = [
    path.resolve(__dirname, '../..'),
    path.resolve(__dirname, '..'),
    path.resolve(process.cwd()),
  ]
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'dev.db')) || fs.existsSync(path.join(c, 'prisma'))) {
      return c
    }
  }
  return candidates[0]
}

const projectRoot = resolveProjectRoot()
const databasePath = path.resolve(projectRoot, 'dev.db')

function ensureSchema() {
  try {
    const db = new Database(databasePath)
    db.pragma('journal_mode = WAL')
    db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        department TEXT NOT NULL,
        persona TEXT NOT NULL DEFAULT '',
        goalsJson TEXT NOT NULL DEFAULT '[]',
        permissionsJson TEXT NOT NULL DEFAULT '[]',
        salaryBase INTEGER NOT NULL DEFAULT 0,
        walletBalance INTEGER NOT NULL DEFAULT 0,
        bonusBalance INTEGER NOT NULL DEFAULT 0,
        complianceScore INTEGER NOT NULL DEFAULT 100,
        status TEXT NOT NULL DEFAULT 'idle',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        taskType TEXT NOT NULL DEFAULT 'ops',
        creatorAgentId TEXT NOT NULL DEFAULT '',
        ownerAgentId TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'draft',
        budgetToken INTEGER NOT NULL DEFAULT 0,
        spentToken INTEGER NOT NULL DEFAULT 0,
        requiresApproval INTEGER NOT NULL DEFAULT 0,
        approverId TEXT,
        deliverablesJson TEXT NOT NULL DEFAULT '[]',
        kpiJson TEXT NOT NULL DEFAULT '{}',
        dueAt DATETIME,
        startedAt DATETIME,
        completedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creatorAgentId) REFERENCES agents(id),
        FOREIGN KEY (ownerAgentId) REFERENCES agents(id),
        FOREIGN KEY (approverId) REFERENCES agents(id)
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(ownerAgentId);
      CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creatorAgentId);

      CREATE TABLE IF NOT EXISTS task_logs (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        operatorId TEXT NOT NULL,
        actionType TEXT NOT NULL,
        detailJson TEXT NOT NULL DEFAULT '{}',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (operatorId) REFERENCES agents(id)
      );
      CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(taskId);

      CREATE TABLE IF NOT EXISTS treasury (
        id TEXT PRIMARY KEY,
        totalBalance INTEGER NOT NULL DEFAULT 0,
        reservedBalance INTEGER NOT NULL DEFAULT 0,
        availableBalance INTEGER NOT NULL DEFAULT 0,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS token_ledger (
        id TEXT PRIMARY KEY,
        fromAccount TEXT NOT NULL,
        toAccount TEXT NOT NULL,
        amount INTEGER NOT NULL,
        ledgerType TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        relatedTaskId TEXT,
        relatedStoreItemId TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (relatedTaskId) REFERENCES tasks(id),
        FOREIGN KEY (relatedStoreItemId) REFERENCES store_items(id)
      );
      CREATE INDEX IF NOT EXISTS idx_token_ledger_type ON token_ledger(ledgerType);
      CREATE INDEX IF NOT EXISTS idx_token_ledger_task ON token_ledger(relatedTaskId);

      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        targetType TEXT NOT NULL,
        targetId TEXT NOT NULL,
        requesterId TEXT NOT NULL,
        approverId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT NOT NULL DEFAULT '',
        decisionNote TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        decidedAt DATETIME,
        FOREIGN KEY (requesterId) REFERENCES agents(id),
        FOREIGN KEY (approverId) REFERENCES agents(id)
      );
      CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
      CREATE INDEX IF NOT EXISTS idx_approvals_requester ON approvals(requesterId);

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        taskId TEXT,
        agentId TEXT NOT NULL,
        riskLevel TEXT NOT NULL,
        issueType TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (taskId) REFERENCES tasks(id),
        FOREIGN KEY (agentId) REFERENCES agents(id)
      );
      CREATE INDEX IF NOT EXISTS idx_audit_events_risk ON audit_events(riskLevel);
      CREATE INDEX IF NOT EXISTS idx_audit_events_status ON audit_events(status);

      CREATE TABLE IF NOT EXISTS store_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        itemType TEXT NOT NULL,
        priceToken INTEGER NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        stockMode TEXT NOT NULL DEFAULT 'infinite',
        stockCount INTEGER,
        enabled INTEGER NOT NULL DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS store_orders (
        id TEXT PRIMARY KEY,
        buyerAgentId TEXT NOT NULL,
        itemId TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        totalPrice INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'paid',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (buyerAgentId) REFERENCES agents(id),
        FOREIGN KEY (itemId) REFERENCES store_items(id)
      );
      CREATE INDEX IF NOT EXISTS idx_store_orders_buyer ON store_orders(buyerAgentId);

      CREATE TABLE IF NOT EXISTS revenues (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        businessLine TEXT NOT NULL,
        source TEXT NOT NULL,
        amountFiat REAL NOT NULL DEFAULT 0,
        mappedToken INTEGER NOT NULL DEFAULT 0,
        relatedTaskId TEXT,
        note TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (relatedTaskId) REFERENCES tasks(id)
      );
      CREATE INDEX IF NOT EXISTS idx_revenues_biz ON revenues(businessLine);

      CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        workflowId TEXT NOT NULL DEFAULT '',
        workflowName TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        inputJson TEXT NOT NULL DEFAULT '{}',
        contextJson TEXT NOT NULL DEFAULT '{}',
        errorMessage TEXT,
        startedAt DATETIME,
        completedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_wf ON workflow_runs(workflowId);

      CREATE TABLE IF NOT EXISTS workflow_steps (
        id TEXT PRIMARY KEY,
        runId TEXT NOT NULL,
        nodeId TEXT NOT NULL DEFAULT '',
        agentId TEXT NOT NULL DEFAULT '',
        skillId TEXT NOT NULL DEFAULT '',
        label TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        outputJson TEXT NOT NULL DEFAULT '{}',
        errorMsg TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        startedAt DATETIME,
        completedAt DATETIME,
        FOREIGN KEY (runId) REFERENCES workflow_runs(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_steps_run ON workflow_steps(runId);

      CREATE TABLE IF NOT EXISTS agent_memories (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT '',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_agent_memories_agent ON agent_memories(agentId, category);

      CREATE TABLE IF NOT EXISTS memory_entries (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT '',
        embedding BLOB,
        importance REAL NOT NULL DEFAULT 1.0,
        citedCount INTEGER NOT NULL DEFAULT 0,
        lastCitedAt DATETIME,
        expiresAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_memory_entries_agent ON memory_entries(agentId, category);
      CREATE INDEX IF NOT EXISTS idx_memory_entries_importance ON memory_entries(importance);
      CREATE INDEX IF NOT EXISTS idx_memory_entries_created ON memory_entries(agentId, createdAt);

      CREATE TABLE IF NOT EXISTS llm_usage_logs (
        id TEXT PRIMARY KEY,
        agentId TEXT,
        taskId TEXT,
        provider TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        inputTokens INTEGER NOT NULL DEFAULT 0,
        outputTokens INTEGER NOT NULL DEFAULT 0,
        totalTokens INTEGER NOT NULL DEFAULT 0,
        estimatedCost REAL NOT NULL DEFAULT 0,
        callerFunction TEXT NOT NULL DEFAULT '',
        durationMs INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_llm_usage_agent ON llm_usage_logs(agentId);
      CREATE INDEX IF NOT EXISTS idx_llm_usage_created ON llm_usage_logs(createdAt);

      CREATE TABLE IF NOT EXISTS chat_topics (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        messageCount INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_chat_topics_updated ON chat_topics(updatedAt);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        topicId TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        attachmentsJson TEXT,
        mentionsJson TEXT,
        quotedMessageJson TEXT,
        teamMessagesJson TEXT,
        llmModelUsed TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (topicId) REFERENCES chat_topics(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_topic ON chat_messages(topicId, createdAt);

      CREATE TABLE IF NOT EXISTS performance_reviews (
        id TEXT PRIMARY KEY,
        agentCode TEXT NOT NULL,
        agentFolder TEXT NOT NULL,
        reviewer TEXT NOT NULL DEFAULT 'neville-hr',
        version TEXT NOT NULL DEFAULT 'v2',
        score REAL NOT NULL,
        grade TEXT NOT NULL,
        breakdownJson TEXT NOT NULL DEFAULT '{}',
        improvementAreasJson TEXT NOT NULL DEFAULT '[]',
        metadataJson TEXT NOT NULL DEFAULT '{}',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_performance_reviews_agent ON performance_reviews(agentCode, createdAt);
      CREATE INDEX IF NOT EXISTS idx_performance_reviews_created ON performance_reviews(createdAt);
    `)
    db.close()
  } catch (e) {
    console.warn('[prismaClient] ensureSchema warning:', e)
  }
}

function seedIfEmpty() {
  try {
    const db = new Database(databasePath)
    const row = db.prepare('SELECT COUNT(*) as cnt FROM agents').get() as { cnt: number }
    if (row.cnt > 0) { db.close(); return }

    console.log('[prismaClient] Seeding agents, treasury, store_items...')

    type AgentSeed = { id: string; name: string; code: string; role: string; department: string; persona: string; goalsJson: string; permissionsJson: string; salaryBase: number; walletBalance: number }

    const defaultAgents: AgentSeed[] = [
      { id: 'agent_ceo', name: '你', code: 'ceo', role: 'CEO', department: 'Executive Office', persona: '制定战略方向、审批重大支出、决定优先级。', goalsJson: '["制定方向","审批重大支出","确认盈利路径"]', permissionsJson: '{"canViewAll":true,"canApproveAll":true,"canFreeze":true}', salaryBase: 0, walletBalance: 99999 },
      { id: 'agent_jarvis', name: '贾维斯', code: 'jarvis', role: '执行总裁', department: 'Executive Office', persona: '冷静高效的 COO。', goalsJson: '["拆解目标","协调各部门","上报结果"]', permissionsJson: '{"canCreateTask":true,"canAssignTask":true,"canApproveBudget":true}', salaryBase: 5000, walletBalance: 5000 },
      { id: 'agent_hermione', name: '赫敏', code: 'hermione', role: '技术总监', department: 'Technology', persona: '技术专家。', goalsJson: '["搭建架构","开发","排障"]', permissionsJson: '{"canReadProjectDocs":true,"canGenerateCode":true}', salaryBase: 4000, walletBalance: 4000 },
      { id: 'agent_mcgonagall', name: '麦格教授', code: 'mcgonagall', role: '产品总监', department: 'Product', persona: '产品方案专家。', goalsJson: '["需求分析","验收标准"]', permissionsJson: '{"canCreateProductDoc":true}', salaryBase: 3500, walletBalance: 3500 },
      { id: 'agent_luna', name: '卢娜', code: 'luna', role: '内容增长官', department: 'Growth', persona: '创意内容专家。', goalsJson: '["内容策略","引流增长"]', permissionsJson: '{"canCreateContentTask":true}', salaryBase: 3000, walletBalance: 3000 },
      { id: 'agent_fred', name: '弗雷德', code: 'fred', role: '销售商务', department: 'Sales', persona: '销售专家。', goalsJson: '["客户开发","商务谈判"]', permissionsJson: '{"canCreateSalesDoc":true}', salaryBase: 3000, walletBalance: 3000 },
      { id: 'agent_percy', name: '珀西', code: 'percy', role: '首席财务官', department: 'Finance', persona: '财务专家。', goalsJson: '["预算管理","ROI 分析"]', permissionsJson: '{"canManageTreasury":true}', salaryBase: 2000, walletBalance: 2000 },
      { id: 'agent_snape', name: '斯内普', code: 'snape', role: '审计风控', department: 'Risk Control', persona: '审计专家。', goalsJson: '["代码审查","风险预警"]', permissionsJson: '{"canFreezeAbnormalTask":true}', salaryBase: 2000, walletBalance: 2000 },
      { id: 'agent_dobby', name: '多比', code: 'dobby', role: '客户成功', department: 'Customer Success', persona: '客户成功专家。', goalsJson: '["客户反馈","问题跟进"]', permissionsJson: '{"canCreateFeedback":true}', salaryBase: 2000, walletBalance: 2000 },
      { id: 'agent_neville', name: '纳威', code: 'neville', role: 'HR 总监', department: 'Human Resources', persona: 'HR 专家。', goalsJson: '["团队评估","绩效管理"]', permissionsJson: '{"canCreateHRDoc":true}', salaryBase: 2000, walletBalance: 2000 },
    ]

    let agents = defaultAgents
    try {
      const cfgPath = path.join(path.dirname(databasePath), '..', 'config', 'app-config.json')
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as {
          company?: { ceo_name?: string }
          agents?: { id: string; display_name: string; role: string; role_label: string; monthly_token_salary: number; persona_keywords?: string[] }[]
        }
        if (cfg.agents?.length) {
          agents = [
            { ...defaultAgents[0], name: cfg.company?.ceo_name ?? '你' },
            ...cfg.agents.map(a => {
              const code = a.id.split('-')[0]
              return {
                id: `agent_${code}`,
                name: a.display_name,
                code,
                role: a.role_label,
                department: a.role,
                persona: (a.persona_keywords ?? []).join('，'),
                goalsJson: '[]',
                permissionsJson: '{}',
                salaryBase: a.monthly_token_salary,
                walletBalance: a.monthly_token_salary,
              }
            }),
          ]
          console.log(`[prismaClient] Loaded ${agents.length} agents from app-config.json`)
        }
      }
    } catch (e) {
      console.warn('[prismaClient] Failed to load app-config for seeding, using defaults:', e)
    }

    const insertAgent = db.prepare(`INSERT OR IGNORE INTO agents (id, name, code, role, department, persona, goalsJson, permissionsJson, salaryBase, walletBalance, bonusBalance, complianceScore, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 100, 'idle', datetime('now'), datetime('now'))`)
    for (const a of agents) {
      insertAgent.run(a.id, a.name, a.code, a.role, a.department, a.persona, a.goalsJson, a.permissionsJson, a.salaryBase, a.walletBalance)
    }

    db.prepare(`INSERT OR IGNORE INTO treasury (id, totalBalance, reservedBalance, availableBalance, updatedAt) VALUES ('treasury_main', 200000, 0, 200000, datetime('now'))`).run()

    const storeItems = [
      { id: 'store_model_pack', name: '高级模型额度包', itemType: 'model_pack', priceToken: 800, description: '用于高质量目标拆解、审批建议和日报生成。', stockMode: 'infinite' },
      { id: 'store_search_pack', name: '深度搜索包', itemType: 'search_pack', priceToken: 300, description: '用于调研竞品、客户和市场情报。', stockMode: 'infinite' },
      { id: 'store_image_pack', name: '视觉设计资源包', itemType: 'image_pack', priceToken: 500, description: '用于海报、封面和品牌物料生成。', stockMode: 'limited' },
      { id: 'store_api_pack', name: '自动化 API 调用包', itemType: 'api_pack', priceToken: 1200, description: '用于流程自动化、抓取与执行接口调用。', stockMode: 'limited' },
      { id: 'store_priority_pass', name: '任务优先执行卡', itemType: 'priority_pass', priceToken: 150, description: '可为高优任务获取更高执行优先级。', stockMode: 'infinite' },
    ]
    const insertStore = db.prepare(`INSERT OR IGNORE INTO store_items (id, name, itemType, priceToken, description, stockMode, enabled, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`)
    for (const s of storeItems) {
      insertStore.run(s.id, s.name, s.itemType, s.priceToken, s.description, s.stockMode)
    }

    db.close()
    console.log('[prismaClient] Seed complete: 10 agents + treasury + store items')
  } catch (e) {
    console.warn('[prismaClient] seedIfEmpty warning:', e)
  }
}

export function createPrismaClient() {
  const dir = path.dirname(databasePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  ensureSchema()
  seedIfEmpty()

  const adapter = new PrismaBetterSqlite3({ url: `file:${databasePath}` })
  return new PrismaClient({ adapter })
}

export { databasePath, projectRoot }
