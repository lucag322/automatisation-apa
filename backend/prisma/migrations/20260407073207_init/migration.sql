-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'editor');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'to_review', 'approved', 'rejected', 'published');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('article', 'report', 'study', 'law', 'event', 'announcement', 'campaign', 'press_release', 'official_document', 'other');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('informational', 'awareness', 'opinion', 'testimonial', 'event_promotion', 'recap', 'call_to_action', 'educational');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('sport', 'adapted_sport', 'disability', 'maison_sport_sante', 'public_health', 'inclusion', 'awareness_campaign', 'law_and_policy', 'official_report', 'public_interest_event');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ReviewAction" AS ENUM ('approve', 'reject', 'request_changes', 'move_to_review', 'regenerate', 'publish');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'editor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "summary" TEXT,
    "sourceType" "SourceType" NOT NULL DEFAULT 'other',
    "publishedAt" TIMESTAMP(3),
    "reliabilityScore" DOUBLE PRECISION,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "title" TEXT NOT NULL,
    "hook" TEXT,
    "body" TEXT NOT NULL,
    "hashtags" TEXT[],
    "cta" TEXT,
    "postType" "PostType" NOT NULL DEFAULT 'informational',
    "theme" "Theme" NOT NULL DEFAULT 'public_health',
    "persona" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiConfidence" DOUBLE PRECISION,
    "targetPublishDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT,
    "body" TEXT NOT NULL,
    "hashtags" TEXT[],
    "cta" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "ReviewAction" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "responseSummary" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Source_contentHash_key" ON "Source"("contentHash");

-- CreateIndex
CREATE INDEX "ContentVersion_contentItemId_idx" ON "ContentVersion"("contentItemId");

-- CreateIndex
CREATE INDEX "ReviewLog_contentItemId_idx" ON "ReviewLog"("contentItemId");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowName_idx" ON "WorkflowRun"("workflowName");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_idx" ON "WorkflowRun"("status");

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
