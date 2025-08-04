-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING';
