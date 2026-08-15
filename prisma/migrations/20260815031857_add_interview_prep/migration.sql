-- CreateTable
CREATE TABLE "InterviewPrep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "companyResearch" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InterviewPrep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterviewPrep_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterviewQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interviewPrepId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "starSituation" TEXT,
    "starTask" TEXT,
    "starAction" TEXT,
    "starResult" TEXT,
    "citedEntityIds" TEXT NOT NULL,
    "rehearsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InterviewQuestion_interviewPrepId_fkey" FOREIGN KEY ("interviewPrepId") REFERENCES "InterviewPrep" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MockInterviewAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "interviewQuestionId" TEXT NOT NULL,
    "responseText" TEXT NOT NULL,
    "scoreRelevance" INTEGER NOT NULL,
    "scoreClarity" INTEGER NOT NULL,
    "scoreStructure" INTEGER NOT NULL,
    "scoreCompleteness" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MockInterviewAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MockInterviewAttempt_interviewQuestionId_fkey" FOREIGN KEY ("interviewQuestionId") REFERENCES "InterviewQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPrep_applicationId_key" ON "InterviewPrep"("applicationId");

-- CreateIndex
CREATE INDEX "InterviewQuestion_interviewPrepId_idx" ON "InterviewQuestion"("interviewPrepId");

-- CreateIndex
CREATE INDEX "MockInterviewAttempt_userId_interviewQuestionId_idx" ON "MockInterviewAttempt"("userId", "interviewQuestionId");
