-- Add YouTube embed support to models
ALTER TABLE "Model"
ADD COLUMN "videoEmbedId" TEXT;
