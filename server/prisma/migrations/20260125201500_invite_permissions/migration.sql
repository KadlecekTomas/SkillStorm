-- Add new invite permissions
ALTER TYPE "public"."PermissionKey" ADD VALUE IF NOT EXISTS 'INVITE_STUDENTS';
ALTER TYPE "public"."PermissionKey" ADD VALUE IF NOT EXISTS 'INVITE_TEACHERS';
