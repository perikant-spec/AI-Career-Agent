-- AlterTable
ALTER TABLE "AIInteraction" ADD COLUMN     "estimatedCostUsd" DOUBLE PRECISION,
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "outputTokens" INTEGER;
