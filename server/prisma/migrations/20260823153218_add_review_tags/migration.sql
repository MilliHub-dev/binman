-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
