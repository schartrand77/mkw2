ALTER TABLE "Model"
ADD COLUMN "printabilityScore" DOUBLE PRECISION,
ADD COLUMN "supportLikelihood" DOUBLE PRECISION,
ADD COLUMN "failureRiskScore" DOUBLE PRECISION,
ADD COLUMN "orientationSuggestion" TEXT,
ADD COLUMN "intelligenceUpdatedAt" TIMESTAMP(3);
