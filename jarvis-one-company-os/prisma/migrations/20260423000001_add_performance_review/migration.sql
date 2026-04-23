-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentCode" TEXT NOT NULL,
    "agentFolder" TEXT NOT NULL,
    "reviewer" TEXT NOT NULL DEFAULT 'neville-hr',
    "version" TEXT NOT NULL DEFAULT 'v2',
    "score" REAL NOT NULL,
    "grade" TEXT NOT NULL,
    "breakdownJson" TEXT NOT NULL DEFAULT '{}',
    "improvementAreasJson" TEXT NOT NULL DEFAULT '[]',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "performance_reviews_agentCode_createdAt_idx" ON "performance_reviews"("agentCode", "createdAt");

-- CreateIndex
CREATE INDEX "performance_reviews_createdAt_idx" ON "performance_reviews"("createdAt");
