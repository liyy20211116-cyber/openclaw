-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "goalsJson" TEXT NOT NULL,
    "permissionsJson" TEXT NOT NULL,
    "salaryBase" INTEGER NOT NULL,
    "walletBalance" INTEGER NOT NULL DEFAULT 0,
    "bonusBalance" INTEGER NOT NULL DEFAULT 0,
    "complianceScore" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "creatorAgentId" TEXT NOT NULL,
    "ownerAgentId" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "budgetToken" INTEGER NOT NULL DEFAULT 0,
    "spentToken" INTEGER NOT NULL DEFAULT 0,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approverId" TEXT,
    "deliverablesJson" TEXT NOT NULL DEFAULT '[]',
    "kpiJson" TEXT NOT NULL DEFAULT '{}',
    "dueAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tasks_creatorAgentId_fkey" FOREIGN KEY ("creatorAgentId") REFERENCES "agents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_ownerAgentId_fkey" FOREIGN KEY ("ownerAgentId") REFERENCES "agents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "agents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "detailJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_logs_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "agents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "treasury" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "totalBalance" INTEGER NOT NULL,
    "reservedBalance" INTEGER NOT NULL,
    "availableBalance" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "token_ledger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromAccount" TEXT NOT NULL,
    "toAccount" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "ledgerType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "relatedTaskId" TEXT,
    "relatedStoreItemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "token_ledger_relatedTaskId_fkey" FOREIGN KEY ("relatedTaskId") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "token_ledger_relatedStoreItemId_fkey" FOREIGN KEY ("relatedStoreItemId") REFERENCES "store_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    CONSTRAINT "approvals_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "agents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "agents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT,
    "agentId" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "audit_events_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "audit_events_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "store_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "priceToken" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "stockMode" TEXT NOT NULL,
    "stockCount" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "store_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyerAgentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalPrice" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "store_orders_buyerAgentId_fkey" FOREIGN KEY ("buyerAgentId") REFERENCES "agents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "store_orders_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "store_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "revenues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "businessLine" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amountFiat" DECIMAL NOT NULL,
    "mappedToken" INTEGER NOT NULL,
    "relatedTaskId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revenues_relatedTaskId_fkey" FOREIGN KEY ("relatedTaskId") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_code_key" ON "agents"("code");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_ownerAgentId_idx" ON "tasks"("ownerAgentId");

-- CreateIndex
CREATE INDEX "tasks_creatorAgentId_idx" ON "tasks"("creatorAgentId");

-- CreateIndex
CREATE INDEX "task_logs_taskId_idx" ON "task_logs"("taskId");

-- CreateIndex
CREATE INDEX "token_ledger_ledgerType_idx" ON "token_ledger"("ledgerType");

-- CreateIndex
CREATE INDEX "token_ledger_relatedTaskId_idx" ON "token_ledger"("relatedTaskId");

-- CreateIndex
CREATE INDEX "approvals_status_idx" ON "approvals"("status");

-- CreateIndex
CREATE INDEX "approvals_requesterId_idx" ON "approvals"("requesterId");

-- CreateIndex
CREATE INDEX "audit_events_riskLevel_idx" ON "audit_events"("riskLevel");

-- CreateIndex
CREATE INDEX "audit_events_status_idx" ON "audit_events"("status");

-- CreateIndex
CREATE INDEX "store_orders_buyerAgentId_idx" ON "store_orders"("buyerAgentId");

-- CreateIndex
CREATE INDEX "revenues_businessLine_idx" ON "revenues"("businessLine");
