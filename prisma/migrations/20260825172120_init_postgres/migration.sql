-- CreateEnum
CREATE TYPE "GameVariant" AS ENUM ('NL', 'KKD', 'BE', 'INT', 'EUR', 'INTERLANDS');

-- CreateEnum
CREATE TYPE "StrategyType" AS ENUM ('SAFE', 'BALANCED', 'AGGRESSIVE');

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gameVariant" "GameVariant" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "competitionId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "kickoffUtc" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsSnapshot" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "roundCode" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oneXTwoHome" DOUBLE PRECISION NOT NULL,
    "oneXTwoDraw" DOUBLE PRECISION NOT NULL,
    "oneXTwoAway" DOUBLE PRECISION NOT NULL,
    "over25" DOUBLE PRECISION,
    "under25" DOUBLE PRECISION,
    "bttsYes" DOUBLE PRECISION,
    "bttsNo" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OddsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "roundCode" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "recommendedScore" TEXT NOT NULL,
    "safeScore" TEXT NOT NULL,
    "balancedScore" TEXT NOT NULL,
    "aggressiveScore" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "roundCode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchesCount" INTEGER NOT NULL,
    "playersCount" INTEGER NOT NULL,
    "predictionsCount" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "SyncJob_syncedAt_idx" ON "SyncJob"("syncedAt");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OddsSnapshot" ADD CONSTRAINT "OddsSnapshot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
