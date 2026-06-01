-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" VARCHAR(500) NOT NULL,
    "displayName" VARCHAR(32),
    "timeInSec" INTEGER,
    "userIp" VARCHAR(45) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_videoId_createdAt_idx" ON "Comment"("videoId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_videoId_parentId_createdAt_idx" ON "Comment"("videoId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_videoId_userIp_createdAt_idx" ON "Comment"("videoId", "userIp", "createdAt");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
