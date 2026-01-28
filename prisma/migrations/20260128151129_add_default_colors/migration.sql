-- DropForeignKey
ALTER TABLE "VerificationToken" DROP CONSTRAINT "VerificationToken_user_fkey";

-- DropIndex
DROP INDEX "ModelImage_modelId_sortOrder_idx";

-- DropIndex
DROP INDEX "PrintOrder_reprintOfId_idx";

-- DropIndex
DROP INDEX "PrintOrder_status_idx";

-- DropIndex
DROP INDEX "PrintOrder_userId_idx";

-- DropIndex
DROP INDEX "PrintOrderItem_orderId_idx";

-- DropIndex
DROP INDEX "PrintOrderRevision_orderId_idx";

-- AlterTable
ALTER TABLE "Achievement" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "JobForm" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Model" ADD COLUMN     "defaultColors" JSONB;

-- AlterTable
ALTER TABLE "ModelComment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ModelImage" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ModelPreviewJob" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PrintOrder" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PushSubscription" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RateLimit" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SiteConfig" DROP COLUMN "heroSubtitle",
DROP COLUMN "heroTitle",
ALTER COLUMN "showApplePayBadge" DROP NOT NULL,
ALTER COLUMN "showGooglePayBadge" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tag" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserAchievement" ALTER COLUMN "awardedAt" SET NOT NULL,
ALTER COLUMN "awardedAt" SET DATA TYPE TIMESTAMP(3);

-- RenameForeignKey
ALTER TABLE "FeaturedModel" RENAME CONSTRAINT "FeaturedModel_model_fkey" TO "FeaturedModel_modelId_fkey";

-- RenameForeignKey
ALTER TABLE "Like" RENAME CONSTRAINT "Like_model_fkey" TO "Like_modelId_fkey";

-- RenameForeignKey
ALTER TABLE "Like" RENAME CONSTRAINT "Like_user_fkey" TO "Like_userId_fkey";

-- RenameForeignKey
ALTER TABLE "ModelPart" RENAME CONSTRAINT "ModelPart_model_fkey" TO "ModelPart_modelId_fkey";

-- RenameForeignKey
ALTER TABLE "ModelTag" RENAME CONSTRAINT "ModelTag_model_fkey" TO "ModelTag_modelId_fkey";

-- RenameForeignKey
ALTER TABLE "ModelTag" RENAME CONSTRAINT "ModelTag_tag_fkey" TO "ModelTag_tagId_fkey";

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;