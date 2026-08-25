-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gameVariant" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "competitionId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "kickoffUtc" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OddsSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "roundCode" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oneXTwoHome" REAL NOT NULL,
    "oneXTwoDraw" REAL NOT NULL,
    "oneXTwoAway" REAL NOT NULL,
    "over25" REAL,
    "under25" REAL,
    "bttsYes" REAL,
    "bttsNo" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OddsSnapshot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "roundCode" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "recommendedScore" TEXT NOT NULL,
    "safeScore" TEXT NOT NULL,
    "balancedScore" TEXT NOT NULL,
    "aggressiveScore" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "goalsPer90" REAL NOT NULL,
    "penaltyTaker" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerProjection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "gameVariant" TEXT NOT NULL,
    "minutesExpectation" INTEGER NOT NULL,
    "teamExpectedGoals" REAL NOT NULL,
    "anytimeScorerOdds" REAL NOT NULL,
    "ev" REAL NOT NULL,
    "roundCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerProjection_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScorerAdviceSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundCode" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "playerNames" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundCode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchesCount" INTEGER NOT NULL,
    "playersCount" INTEGER NOT NULL,
    "predictionsCount" INTEGER NOT NULL,
    "notes" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Competition_code_key" ON "Competition"("code");

-- CreateIndex
CREATE INDEX "OddsSnapshot_roundCode_idx" ON "OddsSnapshot"("roundCode");

-- CreateIndex
CREATE INDEX "OddsSnapshot_matchId_capturedAt_idx" ON "OddsSnapshot"("matchId", "capturedAt");

-- CreateIndex
CREATE INDEX "Prediction_roundCode_idx" ON "Prediction"("roundCode");

-- CreateIndex
CREATE INDEX "PlayerProjection_roundCode_idx" ON "PlayerProjection"("roundCode");

-- CreateIndex
CREATE INDEX "ScorerAdviceSet_roundCode_strategy_idx" ON "ScorerAdviceSet"("roundCode", "strategy");

-- CreateIndex
CREATE INDEX "SyncJob_syncedAt_idx" ON "SyncJob"("syncedAt");
