import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaPath = path.join(root, 'server/prisma/schema.prisma');
const migrationDir = path.join(
  root,
  'server/prisma/migrations/20260809110000_classroom_orchestration_d2c',
);
const migrationPath = path.join(migrationDir, 'migration.sql');

let schema = fs.readFileSync(schemaPath, 'utf8');

function replaceOnce(pattern, replacement, label) {
  const matches = schema.match(pattern);
  if (!matches) throw new Error(`Missing schema anchor: ${label}`);
  schema = schema.replace(pattern, replacement);
}

function patchModel(name, transform) {
  const pattern = new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`, 'm');
  const match = schema.match(pattern);
  if (!match) throw new Error(`Missing model ${name}`);
  const next = transform(match[0]);
  if (next === match[0]) throw new Error(`Model ${name} patch made no change`);
  schema = schema.replace(pattern, next);
}

replaceOnce(
  /enum LiveSessionMode \{[\s\S]*?\n\}/m,
  `enum LiveSessionMode {
  BOARD_ONLY
  SHARED_DEVICES
  DEVICES
  HYBRID
}`,
  'LiveSessionMode',
);

replaceOnce(
  /enum LiveSessionStatus \{[\s\S]*?\n\}/m,
  `enum LiveSessionStatus {
  DRAFT
  RUNNING
  PAUSED
  FINISHED
}

enum LiveSessionSourceKind {
  LEGACY_TEST
  LESSON_EXPERIENCE
}

enum LiveSessionCommandType {
  START
  PAUSE
  RESUME
  NEXT_STAGE
  FINISH
}

enum LiveParticipantStatus {
  CONNECTED
  DISCONNECTED
  LEFT
}`,
  'LiveSessionStatus',
);

patchModel('Membership', (block) => {
  const anchor = '  hostedLiveSessions        LiveSession[]              @relation("HostedLiveSessions")';
  if (!block.includes(anchor)) throw new Error('Membership live-session anchor missing');
  return block.replace(
    anchor,
    `${anchor}\n  liveSessionCommands      LiveSessionCommand[]       @relation("LiveSessionCommandActor")`,
  );
});

patchModel('LessonExperienceVersion', (block) => {
  const end = '\n\n  @@unique([lessonExperienceId, versionNo])';
  if (!block.includes(end)) throw new Error('LessonExperienceVersion unique anchor missing');
  return block.replace(end, `\n  liveSessions             LiveSession[]\n${end}`);
});

patchModel('LessonStage', (block) => {
  const end = '\n\n  @@unique([lessonExperienceVersionId, stageKey])';
  if (!block.includes(end)) throw new Error('LessonStage unique anchor missing');
  return block.replace(
    end,
    `\n  currentLiveSessions      LiveSession[]        @relation("CurrentLiveSessionStage")\n  semanticEvents           LiveSemanticEvent[]\n  learningEvidence         LiveLearningEvidence[]\n${end}`,
  );
});

patchModel('LiveSession', () => `model LiveSession {
  id                        String                   @id @default(uuid()) @map("live_session_id")
  organizationId            String                   @map("organization_id")
  hostId                    String                   @map("host_membership_id")
  classSectionId            String?                  @map("class_section_id")
  testId                    String?                  @map("test_id")
  lessonExperienceVersionId String?                  @map("lesson_experience_version_id")
  sourceKind                LiveSessionSourceKind    @default(LEGACY_TEST) @map("source_kind")
  mode                      LiveSessionMode          @default(BOARD_ONLY)
  status                    LiveSessionStatus        @default(DRAFT)
  ageMode                   LiveAgeMode              @map("age_mode")
  countdownSec              Int?                     @map("countdown_sec")
  currentLessonStageId      String?                  @map("current_lesson_stage_id")
  stateRevision             Int                      @default(0) @map("state_revision")
  startedAt                 DateTime?                @map("started_at")
  pausedAt                  DateTime?                @map("paused_at")
  finishedAt                DateTime?                @map("finished_at")
  xpAwarded                 Boolean                  @default(false) @map("xp_awarded")
  /// Volitelná vazba na kampaň — bleskovka bez kampaně funguje beze změny.
  campaignProgressId        String?                  @map("campaign_progress_id")
  createdAt                 DateTime                 @default(now()) @map("created_at")
  updatedAt                 DateTime                 @updatedAt @map("updated_at")
  organization              Organization             @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  host                      Membership               @relation("HostedLiveSessions", fields: [hostId], references: [id], onDelete: Cascade)
  classSection              ClassSection?            @relation(fields: [classSectionId], references: [id], onDelete: SetNull)
  test                      Test?                    @relation(fields: [testId], references: [id], onDelete: Restrict)
  lessonExperienceVersion   LessonExperienceVersion? @relation(fields: [lessonExperienceVersionId], references: [id], onDelete: Restrict)
  currentLessonStage        LessonStage?             @relation("CurrentLiveSessionStage", fields: [currentLessonStageId], references: [id], onDelete: Restrict)
  campaignProgress          CampaignProgress?        @relation(fields: [campaignProgressId], references: [id], onDelete: SetNull)
  campaignStepUnlock        CampaignStepUnlock?
  rounds                    LiveSessionRound[]
  participants              LiveSessionParticipant[]
  groups                    LiveSessionGroup[]
  commands                  LiveSessionCommand[]
  semanticEvents            LiveSemanticEvent[]
  learningEvidence          LiveLearningEvidence[]
  xpEvents                  ClassPartakXpEvent[]

  @@index([organizationId, status])
  @@index([hostId, createdAt])
  @@index([lessonExperienceVersionId, status])
  @@map("live_sessions")
}`);

patchModel('LiveSessionParticipant', () => `model LiveSessionParticipant {
  id             String                @id @default(uuid()) @map("live_session_participant_id")
  sessionId      String                @map("live_session_id")
  nickname       String                @db.VarChar(50)
  joinToken      String                @unique @map("join_token")
  membershipId   String?               @map("membership_id")
  groupId        String?               @map("live_session_group_id")
  status         LiveParticipantStatus @default(CONNECTED)
  joinedAt       DateTime              @default(now()) @map("joined_at")
  lastSeenAt     DateTime?             @map("last_seen_at")
  disconnectedAt DateTime?             @map("disconnected_at")
  session        LiveSession           @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  membership     Membership?           @relation(fields: [membershipId], references: [id], onDelete: SetNull)
  group          LiveSessionGroup?     @relation(fields: [groupId], references: [id], onDelete: SetNull)
  semanticEvents LiveSemanticEvent[]
  learningEvidence LiveLearningEvidence[]

  @@unique([sessionId, membershipId])
  @@index([sessionId, status])
  @@index([groupId])
  @@map("live_session_participants")
}`);

const newModels = `

model LiveSessionGroup {
  id           String                   @id @default(uuid()) @map("live_session_group_id")
  sessionId    String                   @map("live_session_id")
  label        String                   @db.VarChar(80)
  orderIndex   Int                      @map("order_index")
  createdAt    DateTime                 @default(now()) @map("created_at")
  session      LiveSession              @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  participants LiveSessionParticipant[]

  @@unique([sessionId, orderIndex])
  @@unique([sessionId, label])
  @@index([sessionId])
  @@map("live_session_groups")
}

model LiveSessionCommand {
  id                String                 @id @default(uuid()) @map("live_session_command_id")
  sessionId         String                 @map("live_session_id")
  commandId         String                 @map("command_id") @db.VarChar(100)
  type              LiveSessionCommandType
  actorMembershipId String                 @map("actor_membership_id")
  expectedRevision  Int?                   @map("expected_revision")
  resultingRevision Int                    @map("resulting_revision")
  fromStatus        LiveSessionStatus      @map("from_status")
  toStatus          LiveSessionStatus      @map("to_status")
  fromStageId       String?                @map("from_stage_id")
  toStageId         String?                @map("to_stage_id")
  createdAt         DateTime               @default(now()) @map("created_at")
  session           LiveSession            @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  actor             Membership             @relation("LiveSessionCommandActor", fields: [actorMembershipId], references: [id], onDelete: Restrict)

  @@unique([sessionId, commandId])
  @@index([sessionId, createdAt])
  @@map("live_session_commands")
}

model LiveSemanticEvent {
  id            String                  @id @default(uuid()) @map("live_semantic_event_id")
  sessionId     String                  @map("live_session_id")
  participantId String?                 @map("live_session_participant_id")
  stageId       String                  @map("lesson_stage_id")
  eventId       String                  @map("event_id") @db.VarChar(100)
  eventType     String                  @map("event_type") @db.VarChar(80)
  payload       Json?
  sessionRevision Int                   @map("session_revision")
  occurredAt    DateTime                @map("occurred_at")
  receivedAt    DateTime                @default(now()) @map("received_at")
  session       LiveSession             @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  participant   LiveSessionParticipant? @relation(fields: [participantId], references: [id], onDelete: SetNull)
  stage         LessonStage             @relation(fields: [stageId], references: [id], onDelete: Restrict)
  evidence      LiveLearningEvidence?

  @@unique([sessionId, eventId])
  @@index([sessionId, receivedAt])
  @@index([participantId, receivedAt])
  @@index([stageId])
  @@map("live_semantic_events")
}

model LiveLearningEvidence {
  id              String                  @id @default(uuid()) @map("live_learning_evidence_id")
  sessionId       String                  @map("live_session_id")
  participantId   String?                 @map("live_session_participant_id")
  stageId         String                  @map("lesson_stage_id")
  sourceEventId   String                  @unique @map("source_event_id")
  evidenceType    String                  @map("evidence_type") @db.VarChar(80)
  payload         Json?
  completionIsMastery Boolean             @default(false) @map("completion_is_mastery")
  createdAt       DateTime                @default(now()) @map("created_at")
  session         LiveSession             @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  participant     LiveSessionParticipant? @relation(fields: [participantId], references: [id], onDelete: SetNull)
  stage           LessonStage             @relation(fields: [stageId], references: [id], onDelete: Restrict)
  sourceEvent     LiveSemanticEvent        @relation(fields: [sourceEventId], references: [id], onDelete: Restrict)

  @@index([sessionId, createdAt])
  @@index([participantId, createdAt])
  @@index([stageId])
  @@map("live_learning_evidence")
}
`;

const participantModelEnd = /model LiveSessionParticipant \{[\s\S]*?\n\}/m;
const participantMatch = schema.match(participantModelEnd);
if (!participantMatch) throw new Error('Patched LiveSessionParticipant missing');
schema = schema.replace(
  participantModelEnd,
  `${participantMatch[0]}${newModels}`,
);

fs.writeFileSync(schemaPath, schema);
fs.mkdirSync(migrationDir, { recursive: true });
fs.writeFileSync(
  migrationPath,
  `-- D2-C Classroom Orchestration Foundation\n\nALTER TYPE "LiveSessionMode" ADD VALUE IF NOT EXISTS 'SHARED_DEVICES';\nALTER TYPE "LiveSessionMode" ADD VALUE IF NOT EXISTS 'HYBRID';\nALTER TYPE "LiveSessionStatus" ADD VALUE IF NOT EXISTS 'PAUSED';\n\nCREATE TYPE "LiveSessionSourceKind" AS ENUM ('LEGACY_TEST', 'LESSON_EXPERIENCE');\nCREATE TYPE "LiveSessionCommandType" AS ENUM ('START', 'PAUSE', 'RESUME', 'NEXT_STAGE', 'FINISH');\nCREATE TYPE "LiveParticipantStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'LEFT');\n\nALTER TABLE "live_sessions"\n  ALTER COLUMN "test_id" DROP NOT NULL,\n  ADD COLUMN "lesson_experience_version_id" TEXT,\n  ADD COLUMN "source_kind" "LiveSessionSourceKind" NOT NULL DEFAULT 'LEGACY_TEST',\n  ADD COLUMN "current_lesson_stage_id" TEXT,\n  ADD COLUMN "state_revision" INTEGER NOT NULL DEFAULT 0,\n  ADD COLUMN "paused_at" TIMESTAMP(3);\n\nALTER TABLE "live_sessions"\n  ADD CONSTRAINT "live_sessions_exactly_one_source_check" CHECK (\n    ("source_kind" = 'LEGACY_TEST' AND "test_id" IS NOT NULL AND "lesson_experience_version_id" IS NULL) OR\n    ("source_kind" = 'LESSON_EXPERIENCE' AND "test_id" IS NULL AND "lesson_experience_version_id" IS NOT NULL)\n  ),\n  ADD CONSTRAINT "live_sessions_revision_nonnegative_check" CHECK ("state_revision" >= 0);\n\nALTER TABLE "live_sessions"\n  ADD CONSTRAINT "live_sessions_lesson_experience_version_id_fkey"\n  FOREIGN KEY ("lesson_experience_version_id") REFERENCES "lesson_experience_versions"("lesson_experience_version_id") ON DELETE RESTRICT ON UPDATE CASCADE,\n  ADD CONSTRAINT "live_sessions_current_lesson_stage_id_fkey"\n  FOREIGN KEY ("current_lesson_stage_id") REFERENCES "lesson_stages"("lesson_stage_id") ON DELETE RESTRICT ON UPDATE CASCADE;\n\nCREATE INDEX "live_sessions_lesson_experience_version_id_status_idx"\n  ON "live_sessions"("lesson_experience_version_id", "status");\n\nCREATE TABLE "live_session_groups" (\n  "live_session_group_id" TEXT NOT NULL,\n  "live_session_id" TEXT NOT NULL,\n  "label" VARCHAR(80) NOT NULL,\n  "order_index" INTEGER NOT NULL,\n  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  CONSTRAINT "live_session_groups_pkey" PRIMARY KEY ("live_session_group_id"),\n  CONSTRAINT "live_session_groups_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "live_sessions"("live_session_id") ON DELETE CASCADE ON UPDATE CASCADE,\n  CONSTRAINT "live_session_groups_order_nonnegative_check" CHECK ("order_index" >= 0)\n);\nCREATE UNIQUE INDEX "live_session_groups_live_session_id_order_index_key" ON "live_session_groups"("live_session_id", "order_index");\nCREATE UNIQUE INDEX "live_session_groups_live_session_id_label_key" ON "live_session_groups"("live_session_id", "label");\nCREATE INDEX "live_session_groups_live_session_id_idx" ON "live_session_groups"("live_session_id");\n\nALTER TABLE "live_session_participants"\n  ADD COLUMN "live_session_group_id" TEXT,\n  ADD COLUMN "status" "LiveParticipantStatus" NOT NULL DEFAULT 'CONNECTED',\n  ADD COLUMN "disconnected_at" TIMESTAMP(3),\n  ADD CONSTRAINT "live_session_participants_live_session_group_id_fkey" FOREIGN KEY ("live_session_group_id") REFERENCES "live_session_groups"("live_session_group_id") ON DELETE SET NULL ON UPDATE CASCADE;\nCREATE UNIQUE INDEX "live_session_participants_live_session_id_membership_id_key"\n  ON "live_session_participants"("live_session_id", "membership_id");\nCREATE INDEX "live_session_participants_live_session_id_status_idx" ON "live_session_participants"("live_session_id", "status");\nCREATE INDEX "live_session_participants_live_session_group_id_idx" ON "live_session_participants"("live_session_group_id");\n\nCREATE TABLE "live_session_commands" (\n  "live_session_command_id" TEXT NOT NULL,\n  "live_session_id" TEXT NOT NULL,\n  "command_id" VARCHAR(100) NOT NULL,\n  "type" "LiveSessionCommandType" NOT NULL,\n  "actor_membership_id" TEXT NOT NULL,\n  "expected_revision" INTEGER,\n  "resulting_revision" INTEGER NOT NULL,\n  "from_status" "LiveSessionStatus" NOT NULL,\n  "to_status" "LiveSessionStatus" NOT NULL,\n  "from_stage_id" TEXT,\n  "to_stage_id" TEXT,\n  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  CONSTRAINT "live_session_commands_pkey" PRIMARY KEY ("live_session_command_id"),\n  CONSTRAINT "live_session_commands_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "live_sessions"("live_session_id") ON DELETE CASCADE ON UPDATE CASCADE,\n  CONSTRAINT "live_session_commands_actor_membership_id_fkey" FOREIGN KEY ("actor_membership_id") REFERENCES "memberships"("membership_id") ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT "live_session_commands_revisions_nonnegative_check" CHECK (("expected_revision" IS NULL OR "expected_revision" >= 0) AND "resulting_revision" >= 0)\n);\nCREATE UNIQUE INDEX "live_session_commands_live_session_id_command_id_key" ON "live_session_commands"("live_session_id", "command_id");\nCREATE INDEX "live_session_commands_live_session_id_created_at_idx" ON "live_session_commands"("live_session_id", "created_at");\n\nCREATE TABLE "live_semantic_events" (\n  "live_semantic_event_id" TEXT NOT NULL,\n  "live_session_id" TEXT NOT NULL,\n  "live_session_participant_id" TEXT,\n  "lesson_stage_id" TEXT NOT NULL,\n  "event_id" VARCHAR(100) NOT NULL,\n  "event_type" VARCHAR(80) NOT NULL,\n  "payload" JSONB,\n  "session_revision" INTEGER NOT NULL,\n  "occurred_at" TIMESTAMP(3) NOT NULL,\n  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  CONSTRAINT "live_semantic_events_pkey" PRIMARY KEY ("live_semantic_event_id"),\n  CONSTRAINT "live_semantic_events_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "live_sessions"("live_session_id") ON DELETE CASCADE ON UPDATE CASCADE,\n  CONSTRAINT "live_semantic_events_live_session_participant_id_fkey" FOREIGN KEY ("live_session_participant_id") REFERENCES "live_session_participants"("live_session_participant_id") ON DELETE SET NULL ON UPDATE CASCADE,\n  CONSTRAINT "live_semantic_events_lesson_stage_id_fkey" FOREIGN KEY ("lesson_stage_id") REFERENCES "lesson_stages"("lesson_stage_id") ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT "live_semantic_events_revision_nonnegative_check" CHECK ("session_revision" >= 0)\n);\nCREATE UNIQUE INDEX "live_semantic_events_live_session_id_event_id_key" ON "live_semantic_events"("live_session_id", "event_id");\nCREATE INDEX "live_semantic_events_live_session_id_received_at_idx" ON "live_semantic_events"("live_session_id", "received_at");\nCREATE INDEX "live_semantic_events_live_session_participant_id_received_at_idx" ON "live_semantic_events"("live_session_participant_id", "received_at");\nCREATE INDEX "live_semantic_events_lesson_stage_id_idx" ON "live_semantic_events"("lesson_stage_id");\n\nCREATE TABLE "live_learning_evidence" (\n  "live_learning_evidence_id" TEXT NOT NULL,\n  "live_session_id" TEXT NOT NULL,\n  "live_session_participant_id" TEXT,\n  "lesson_stage_id" TEXT NOT NULL,\n  "source_event_id" TEXT NOT NULL,\n  "evidence_type" VARCHAR(80) NOT NULL,\n  "payload" JSONB,\n  "completion_is_mastery" BOOLEAN NOT NULL DEFAULT false,\n  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  CONSTRAINT "live_learning_evidence_pkey" PRIMARY KEY ("live_learning_evidence_id"),\n  CONSTRAINT "live_learning_evidence_live_session_id_fkey" FOREIGN KEY ("live_session_id") REFERENCES "live_sessions"("live_session_id") ON DELETE CASCADE ON UPDATE CASCADE,\n  CONSTRAINT "live_learning_evidence_live_session_participant_id_fkey" FOREIGN KEY ("live_session_participant_id") REFERENCES "live_session_participants"("live_session_participant_id") ON DELETE SET NULL ON UPDATE CASCADE,\n  CONSTRAINT "live_learning_evidence_lesson_stage_id_fkey" FOREIGN KEY ("lesson_stage_id") REFERENCES "lesson_stages"("lesson_stage_id") ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT "live_learning_evidence_source_event_id_fkey" FOREIGN KEY ("source_event_id") REFERENCES "live_semantic_events"("live_semantic_event_id") ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT "live_learning_evidence_completion_not_mastery_check" CHECK ("completion_is_mastery" = false)\n);\nCREATE UNIQUE INDEX "live_learning_evidence_source_event_id_key" ON "live_learning_evidence"("source_event_id");\nCREATE INDEX "live_learning_evidence_live_session_id_created_at_idx" ON "live_learning_evidence"("live_session_id", "created_at");\nCREATE INDEX "live_learning_evidence_live_session_participant_id_created_at_idx" ON "live_learning_evidence"("live_session_participant_id", "created_at");\nCREATE INDEX "live_learning_evidence_lesson_stage_id_idx" ON "live_learning_evidence"("lesson_stage_id");\n\nCREATE OR REPLACE FUNCTION live_session_source_guard() RETURNS trigger AS $$\nDECLARE\n  lesson_status TEXT;\n  lesson_scope TEXT;\n  lesson_org TEXT;\n  lesson_modes TEXT[];\n  stage_version TEXT;\nBEGIN\n  IF NEW."source_kind" = 'LEGACY_TEST' THEN\n    IF NEW."test_id" IS NULL OR NEW."lesson_experience_version_id" IS NOT NULL THEN\n      RAISE EXCEPTION 'LIVE_SESSION_SOURCE_INVALID';\n    END IF;\n    IF NEW."current_lesson_stage_id" IS NOT NULL THEN\n      RAISE EXCEPTION 'LIVE_SESSION_LEGACY_STAGE_FORBIDDEN';\n    END IF;\n    RETURN NEW;\n  END IF;\n\n  SELECT lev."status"::text, le."scope"::text, le."organization_id", lev."supported_modes"::text[]\n    INTO lesson_status, lesson_scope, lesson_org, lesson_modes\n  FROM "lesson_experience_versions" lev\n  JOIN "lesson_experiences" le ON le."lesson_experience_id" = lev."lesson_experience_id"\n  WHERE lev."lesson_experience_version_id" = NEW."lesson_experience_version_id";\n\n  IF lesson_status IS NULL THEN RAISE EXCEPTION 'LIVE_SESSION_LESSON_NOT_FOUND'; END IF;\n  IF lesson_status <> 'PUBLISHED' THEN RAISE EXCEPTION 'LIVE_SESSION_LESSON_NOT_PUBLISHED'; END IF;\n  IF lesson_scope = 'ORGANIZATION' AND lesson_org IS DISTINCT FROM NEW."organization_id" THEN\n    RAISE EXCEPTION 'LIVE_SESSION_LESSON_TENANT_MISMATCH';\n  END IF;\n  IF NOT (NEW."mode"::text = ANY(lesson_modes)) THEN\n    RAISE EXCEPTION 'LIVE_SESSION_MODE_UNSUPPORTED';\n  END IF;\n\n  IF NEW."current_lesson_stage_id" IS NOT NULL THEN\n    SELECT "lesson_experience_version_id" INTO stage_version\n    FROM "lesson_stages" WHERE "lesson_stage_id" = NEW."current_lesson_stage_id";\n    IF stage_version IS DISTINCT FROM NEW."lesson_experience_version_id" THEN\n      RAISE EXCEPTION 'LIVE_SESSION_STAGE_VERSION_MISMATCH';\n    END IF;\n  END IF;\n\n  RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;\n\nCREATE TRIGGER live_session_source_guard_trigger\nBEFORE INSERT OR UPDATE ON "live_sessions"\nFOR EACH ROW EXECUTE FUNCTION live_session_source_guard();\n\nCREATE OR REPLACE FUNCTION live_orchestration_history_immutable() RETURNS trigger AS $$\nBEGIN\n  RAISE EXCEPTION 'LIVE_ORCHESTRATION_HISTORY_IMMUTABLE';\nEND;\n$$ LANGUAGE plpgsql;\n\nCREATE TRIGGER live_session_commands_immutable\nBEFORE UPDATE OR DELETE ON "live_session_commands"\nFOR EACH ROW EXECUTE FUNCTION live_orchestration_history_immutable();\nCREATE TRIGGER live_semantic_events_immutable\nBEFORE UPDATE OR DELETE ON "live_semantic_events"\nFOR EACH ROW EXECUTE FUNCTION live_orchestration_history_immutable();\nCREATE TRIGGER live_learning_evidence_immutable\nBEFORE UPDATE OR DELETE ON "live_learning_evidence"\nFOR EACH ROW EXECUTE FUNCTION live_orchestration_history_immutable();\n`,
);

console.log('D2-C schema + migration bootstrap written.');
