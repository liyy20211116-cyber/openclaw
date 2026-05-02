-- CreateTable
CREATE TABLE "memory_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "embedding" BLOB,
    "importance" REAL NOT NULL DEFAULT 1.0,
    "citedCount" INTEGER NOT NULL DEFAULT 0,
    "lastCitedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "memory_entries_agentId_category_idx" ON "memory_entries"("agentId", "category");

-- CreateIndex
CREATE INDEX "memory_entries_importance_idx" ON "memory_entries"("importance");

-- CreateIndex
CREATE INDEX "memory_entries_agentId_createdAt_idx" ON "memory_entries"("agentId", "createdAt");
