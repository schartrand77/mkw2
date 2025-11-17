-- Add viewer/preview file paths to support derived STL previews for 3MF uploads
ALTER TABLE "Model" ADD COLUMN "viewerFilePath" TEXT;
ALTER TABLE "ModelPart" ADD COLUMN "previewFilePath" TEXT;
