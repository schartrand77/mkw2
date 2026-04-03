-- Add support ratio fields for automatic support/time pricing
ALTER TABLE "Model" ADD COLUMN "supportRatio" DOUBLE PRECISION;
ALTER TABLE "ModelPart" ADD COLUMN "supportRatio" DOUBLE PRECISION;