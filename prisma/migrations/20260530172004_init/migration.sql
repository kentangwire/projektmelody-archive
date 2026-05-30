-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hlsMasterUrl" TEXT NOT NULL,
    "torrentUrl" TEXT,
    "magnetUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoTag" (
    "videoId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoTag_pkey" PRIMARY KEY ("videoId","tagId")
);

-- CreateTable
CREATE TABLE "Timestamp" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "timeInSec" INTEGER NOT NULL,
    "description" VARCHAR(60) NOT NULL,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "userIp" VARCHAR(45) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timestamp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Video_createdAt_idx" ON "Video"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "VideoTag_tagId_idx" ON "VideoTag"("tagId");

-- CreateIndex
CREATE INDEX "Timestamp_videoId_timeInSec_createdAt_idx" ON "Timestamp"("videoId", "timeInSec", "createdAt");

-- CreateIndex
CREATE INDEX "Timestamp_videoId_userIp_createdAt_idx" ON "Timestamp"("videoId", "userIp", "createdAt");

-- AddForeignKey
ALTER TABLE "VideoTag" ADD CONSTRAINT "VideoTag_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoTag" ADD CONSTRAINT "VideoTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timestamp" ADD CONSTRAINT "Timestamp_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
