// test/e2e/campaigns.e2e-spec.ts
/**
 * Kampaně (Výprava/Mise) — meziherní vrstva nad bleskovkami. E2e:
 *
 * A. List dle ročníku (1. stupeň vidí Výpravu, ne Misi) + start + 409 duplicitní start
 * B. Advance ve finish: +1 zastávka, unlock se samolepkovým stepKey, roundsPlayed
 *    snapshot, XP vzorec beze změny; double finish → 409 a žádný double advance;
 *    detail vrací odemčený krok plně a dalšího jen jako siluetu (bez scény)
 * C. Správnost NEOVLIVŇUJE postup: opačné outcomes → identický posun
 * D. Ukončení v půlce kol: 1 kolo ze 3 → zastávka ANO; 0 kol → zastávka NE
 * E. Vazba session↔kampaň: bez třídy 400, cizí třída 400, dokončená kampaň 400
 * F. RBAC: student 403, cizí org 404, učitel bez úvazku 403, ředitel 200
 * G. Mise: dokončení, epilogue (jen po dokončení, jen Mise), reveal pojistka —
 *    vzkaz minulé třídy se v detailu NEOBJEVÍ před explicitním revealem
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import * as request from 'supertest';
import {
  LiveRoundOutcome,
  OrganizationStatus,
  PublishStatus,
  QuestionType,
  SchoolGrade,
} from '@prisma/client';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';
import {
  XP_PER_FINISHED_SESSION,
  XP_PER_PLAYED_ROUND,
} from '@/live-sessions/live-sessions.constants';

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

describe('Campaigns — Výprava/Mise nad bleskovkami (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgAId: string;
  let orgBId: string;
  let teacherToken: string; // učitel s úvazkem (homeroom) v orgA
  let directorToken: string; // ředitel orgA
  let otherTeacherToken: string; // učitel orgA BEZ úvazku ke třídám
  let studentToken: string;
  let teacherBToken: string; // učitel orgB
  let testId: string;
  let youngClassId: string; // GRADE_2 — Výprava
  let missionClassId: string; // GRADE_7 — Mise
  let missionClass2Id: string; // GRADE_8 — Mise (nástupnická třída)
  let userIds: string[];

  const api = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;

  async function startProgress(campaignId: string, classSectionId: string) {
    const res = await api()
      .post('/campaigns/progress')
      .set('Authorization', auth(teacherToken))
      .send({ campaignId, classSectionId })
      .expect(201);
    return unwrap(res);
  }

  async function createCampaignSession(
    campaignProgressId: string,
    classSectionId: string,
  ) {
    const createRes = await api()
      .post('/live-sessions')
      .set('Authorization', auth(teacherToken))
      .send({ testId, classSectionId, campaignProgressId })
      .expect(201);
    const session = unwrap(createRes);
    const startRes = await api()
      .post(`/live-sessions/${session.id}/start`)
      .set('Authorization', auth(teacherToken))
      .expect(201);
    return unwrap(startRes);
  }

  async function playRound(
    sessionId: string,
    roundId: string,
    outcome: LiveRoundOutcome,
  ) {
    await api()
      .post(`/live-sessions/${sessionId}/rounds/${roundId}/reveal`)
      .set('Authorization', auth(teacherToken))
      .expect(201);
    await api()
      .post(`/live-sessions/${sessionId}/rounds/${roundId}/outcome`)
      .set('Authorization', auth(teacherToken))
      .send({ outcome })
      .expect(201);
  }

  async function finishSession(sessionId: string) {
    const res = await api()
      .post(`/live-sessions/${sessionId}/finish`)
      .set('Authorization', auth(teacherToken))
      .expect(201);
    return unwrap(res);
  }

  /** Odehraje kampaňovou bleskovku: `rounds` kol s daným outcome + finish. */
  async function playCampaignSession(
    progressId: string,
    classSectionId: string,
    rounds: number,
    outcome: LiveRoundOutcome = LiveRoundOutcome.SPLIT,
  ) {
    const session = await createCampaignSession(progressId, classSectionId);
    for (const round of session.rounds.slice(0, rounds)) {
      await playRound(session.id, round.id, outcome);
    }
    return finishSession(session.id);
  }

  async function getDetail(progressId: string, token = teacherToken) {
    const res = await api()
      .get(`/campaigns/progress/${progressId}`)
      .set('Authorization', auth(token))
      .expect(200);
    return unwrap(res);
  }

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    const ts = Date.now();
    const ctxA = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: `camp_A_${ts}`,
      with: { student: true },
    });
    const ctxB = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: `camp_B_${ts}`,
    });

    orgAId = ctxA.organization.id;
    orgBId = ctxB.organization.id;
    teacherToken = ctxA.actor.accessToken;
    directorToken = ctxA.owner.accessToken;
    studentToken = ctxA.student!.accessToken;
    teacherBToken = ctxB.actor.accessToken;
    const otherTeacher = await ctxA.addMember('TEACHER' as any, 'teacher2');
    otherTeacherToken = otherTeacher.accessToken;
    userIds = [
      ctxA.owner.user.id,
      ctxA.actor.user.id,
      ctxA.student!.user.id,
      otherTeacher.user.id,
      ctxB.owner.user.id,
      ctxB.actor.user.id,
    ];

    await prisma.organization.updateMany({
      where: { id: { in: [orgAId, orgBId] } },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const yearA = await prisma.academicYear.findFirst({
      where: { orgId: orgAId, isCurrent: true },
      select: { id: true },
    });
    if (!yearA) throw new Error('Missing current academic year in orgA');
    const yearB = await prisma.academicYear.findFirst({
      where: { orgId: orgBId, isCurrent: true },
      select: { id: true },
    });
    if (!yearB) throw new Error('Missing current academic year in orgB');
    await prisma.classSection.create({
      data: {
        orgId: orgBId,
        yearId: yearB.id,
        grade: SchoolGrade.GRADE_5,
        section: 'B',
      },
    });

    // Učitel (host) dostane Teacher záznam a homeroom u všech tří tříd —
    // campaigns RBAC vyžaduje teach-vztah, ne jen roli TEACHER.
    const teacherMembershipId = ctxA.actor.membership!.id as string;
    const teacherRecord = await prisma.teacher.create({
      data: { membershipId: teacherMembershipId, organizationId: orgAId },
    });
    // otherTeacher má Teacher záznam, ale ŽÁDNÝ úvazek → musí dostat 403
    await prisma.teacher.create({
      data: {
        membershipId: otherTeacher.membership!.id as string,
        organizationId: orgAId,
      },
    });

    const mkClass = (grade: SchoolGrade, section: string) =>
      prisma.classSection.create({
        data: {
          orgId: orgAId,
          yearId: yearA.id,
          grade,
          section,
          teacherId: teacherRecord.id,
        },
      });
    youngClassId = (await mkClass(SchoolGrade.GRADE_2, 'V')).id;
    missionClassId = (await mkClass(SchoolGrade.GRADE_7, 'M')).id;
    missionClass2Id = (await mkClass(SchoolGrade.GRADE_8, 'N')).id;

    const test = await prisma.test.create({
      data: {
        organizationId: orgAId,
        title: 'Kampaňová bleskovka fixture',
        status: PublishStatus.PUBLISHED,
        publishedAt: new Date(),
        creatorId: teacherMembershipId,
        questions: {
          create: [
            {
              text: 'Kolik nohou má pavouk?',
              type: QuestionType.MULTIPLE_CHOICE,
              order: 1,
              correctAnswer: '8',
              options: {
                create: [{ text: '8' }, { text: '6' }, { text: '4' }],
              },
            },
            {
              text: 'Slunce je hvězda.',
              type: QuestionType.TRUE_FALSE,
              order: 2,
              correctAnswer: 'true',
            },
            {
              text: 'Kolik je 7 × 8?',
              type: QuestionType.MULTIPLE_CHOICE,
              order: 3,
              correctAnswer: '56',
              options: {
                create: [{ text: '56' }, { text: '54' }, { text: '64' }],
              },
            },
          ],
        },
      },
    });
    testId = test.id;
  });

  afterAll(async () => {
    if (orgAId && orgBId) {
      const orgs = [orgAId, orgBId];
      await prisma.campaignStepUnlock.deleteMany({
        where: { progress: { organizationId: { in: orgs } } },
      });
      await prisma.campaignProgress.deleteMany({
        where: { organizationId: { in: orgs } },
      });
      await prisma.classPartakXpEvent.deleteMany({
        where: { classPartak: { organizationId: { in: orgs } } },
      });
      await prisma.classPartak.deleteMany({
        where: { organizationId: { in: orgs } },
      });
      await prisma.liveSession.deleteMany({
        where: { organizationId: { in: orgs } },
      });
      await prisma.test.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.teacherClassSection.deleteMany({
        where: { classSection: { orgId: { in: orgs } } },
      });
      await prisma.classSection.deleteMany({ where: { orgId: { in: orgs } } });
      await prisma.teacher.deleteMany({
        where: { organizationId: { in: orgs } },
      });
      await prisma.membership.deleteMany({
        where: { organizationId: { in: orgs } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
    }
    if (userIds?.length) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('A: list filtruje dle ročníku, start založí progress, duplicitní start → 409', async () => {
    const listYoung = unwrap(
      await api()
        .get(`/campaigns?classSectionId=${youngClassId}`)
        .set('Authorization', auth(teacherToken))
        .expect(200),
    );
    const ids = listYoung.map((c: { id: string }) => c.id);
    expect(ids).toContain('vyprava-svetluska');
    expect(ids).not.toContain('mise-archiv'); // GRADE_2 mimo rozsah Mise

    const progress = await startProgress('vyprava-svetluska', youngClassId);
    expect(progress.status).toBe('ACTIVE');
    expect(progress.position).toBe(0);
    expect(progress.totalSteps).toBe(8);

    await api()
      .post('/campaigns/progress')
      .set('Authorization', auth(teacherToken))
      .send({ campaignId: 'vyprava-svetluska', classSectionId: youngClassId })
      .expect(409);

    // Mise pro GRADE_2 → 400 mimo ročník
    await api()
      .post('/campaigns/progress')
      .set('Authorization', auth(teacherToken))
      .send({ campaignId: 'mise-archiv', classSectionId: youngClassId })
      .expect(400);
  });

  it('B: finish posune o zastávku, snapshotne kola, nemění XP vzorec; double finish → 409 bez double advance', async () => {
    const detail0 = await getDetail(await currentExpeditionId());
    expect(detail0.position).toBe(0);

    const session = await createCampaignSession(detail0.id, youngClassId);
    expect(session.rounds).toHaveLength(3);
    await playRound(session.id, session.rounds[0].id, LiveRoundOutcome.SPLIT);
    await playRound(
      session.id,
      session.rounds[1].id,
      LiveRoundOutcome.MOSTLY_CORRECT,
    );
    const finish = await finishSession(session.id);

    // XP beze změny — kampaň do vzorce nevstupuje
    expect(finish.xpDelta).toBe(
      2 * XP_PER_PLAYED_ROUND + XP_PER_FINISHED_SESSION,
    );
    expect(finish.campaignAdvance).toMatchObject({
      stepIndex: 1,
      stepKey: 'rozkvetla-louka',
      position: 1,
      totalSteps: 8,
      status: 'ACTIVE',
    });

    await api()
      .post(`/live-sessions/${session.id}/finish`)
      .set('Authorization', auth(teacherToken))
      .expect(409);

    const detail = await getDetail(detail0.id);
    expect(detail.position).toBe(1); // žádný double advance
    expect(detail.unlockedSteps).toHaveLength(1);
    const unlocked = detail.unlockedSteps[0];
    expect(unlocked.roundsPlayed).toBe(2);
    expect(unlocked.content.sticker.key).toBe('zvonek');
    expect(unlocked.content.hook).toBeTruthy();
    // Silueta dalšího kroku: jen key/title, žádná scéna/samolepka
    expect(detail.nextStep).toMatchObject({ stepIndex: 2 });
    expect(detail.nextStep.scene).toBeUndefined();
    expect(detail.nextStep.sticker).toBeUndefined();
    expect(JSON.stringify(detail.unlockedSteps)).not.toContain('svetlusci');
  });

  it('C: opačné outcomes → identický postup (správnost nerozhoduje)', async () => {
    const progressId = await currentExpeditionId();
    const before = (await getDetail(progressId)).position;

    const f1 = await playCampaignSession(
      progressId,
      youngClassId,
      3,
      LiveRoundOutcome.MOSTLY_CORRECT,
    );
    const f2 = await playCampaignSession(
      progressId,
      youngClassId,
      3,
      LiveRoundOutcome.MOSTLY_WRONG,
    );
    expect(f1.campaignAdvance.stepIndex).toBe(before + 1);
    expect(f2.campaignAdvance.stepIndex).toBe(before + 2);
    // identický tvar posunu: vždy +1 zastávka bez ohledu na outcome
    expect(f1.campaignAdvance.position - before).toBe(1);
    expect(f2.campaignAdvance.position - f1.campaignAdvance.position).toBe(1);
  });

  it('D: finish v půlce kol → zastávka ANO (≥1 kolo); 0 kol → zastávka NE', async () => {
    const progressId = await currentExpeditionId();
    const before = (await getDetail(progressId)).position;

    // 1 kolo ze 3 → postup se počítá, kola se neztrácejí (roundsPlayed=1)
    const partial = await playCampaignSession(progressId, youngClassId, 1);
    expect(partial.campaignAdvance.stepIndex).toBe(before + 1);

    // 0 kol → finish projde, ale zastávka se nepočítá
    const empty = await playCampaignSession(progressId, youngClassId, 0);
    expect(empty.campaignAdvance).toBeNull();
    expect((await getDetail(progressId)).position).toBe(before + 1);
  });

  it('E: vazba session↔kampaň — bez třídy 400, cizí třída 400', async () => {
    const progressId = await currentExpeditionId();

    await api()
      .post('/live-sessions')
      .set('Authorization', auth(teacherToken))
      .send({ testId, campaignProgressId: progressId })
      .expect(400);

    await api()
      .post('/live-sessions')
      .set('Authorization', auth(teacherToken))
      .send({
        testId,
        classSectionId: missionClassId,
        campaignProgressId: progressId,
      })
      .expect(400);
  });

  it('F: RBAC — student 403, cizí org 404, učitel bez úvazku 403, ředitel 200', async () => {
    const progressId = await currentExpeditionId();

    await api()
      .get(`/campaigns?classSectionId=${youngClassId}`)
      .set('Authorization', auth(studentToken))
      .expect(403);

    await api()
      .get(`/campaigns/progress/${progressId}`)
      .set('Authorization', auth(teacherBToken))
      .expect(404);

    await api()
      .get(`/campaigns?classSectionId=${youngClassId}`)
      .set('Authorization', auth(otherTeacherToken))
      .expect(403);
    await api()
      .get(`/campaigns/progress/${progressId}`)
      .set('Authorization', auth(otherTeacherToken))
      .expect(403);

    await api()
      .get(`/campaigns/progress/${progressId}`)
      .set('Authorization', auth(directorToken))
      .expect(200);
  });

  it('G: Mise — dokončení, epilogue jen po dokončení, reveal pojistka vzkazu', async () => {
    const mission = await startProgress('mise-archiv', missionClassId);
    expect(mission.totalSteps).toBe(3);
    // první třída v org nemá od koho dostat vzkaz
    expect(mission.predecessorMessageAvailable).toBe(false);

    // epilogue před dokončením → 400
    await api()
      .post(`/campaigns/progress/${mission.id}/epilogue`)
      .set('Authorization', auth(teacherToken))
      .send({ message: 'Předčasný vzkaz' })
      .expect(400);

    // 3 kapitoly → COMPLETED; poslední finish vrátí status COMPLETED
    await playCampaignSession(mission.id, missionClassId, 2);
    await playCampaignSession(mission.id, missionClassId, 3);
    const last = await playCampaignSession(mission.id, missionClassId, 1);
    expect(last.campaignAdvance.status).toBe('COMPLETED');

    // na dokončenou kampaň nejde navázat další bleskovka
    await api()
      .post('/live-sessions')
      .set('Authorization', auth(teacherToken))
      .send({
        testId,
        classSectionId: missionClassId,
        campaignProgressId: mission.id,
      })
      .expect(400);

    // epilogue na Výpravě → 400 EPILOGUE_NOT_SUPPORTED
    await api()
      .post(`/campaigns/progress/${await currentExpeditionId()}/epilogue`)
      .set('Authorization', auth(teacherToken))
      .send({ message: 'Výprava vzkazy nemá' })
      .expect(400);

    // teď už epilogue projde
    await api()
      .post(`/campaigns/progress/${mission.id}/epilogue`)
      .set('Authorization', auth(teacherToken))
      .send({ message: 'Držte se, budoucí třído! Archiv je váš.' })
      .expect(201);

    // nástupnická třída: progress se založí se snapshotem zdroje vzkazu
    const successor = await startProgress('mise-archiv', missionClass2Id);
    expect(successor.predecessorMessageAvailable).toBe(true);

    // REVEAL POJISTKA: detail vzkaz NEVRACÍ, dokud učitel nepotvrdí
    let detail = await getDetail(successor.id);
    expect(detail.predecessorMessage).toBeNull();
    expect(detail.predecessorMessageRevealedAt).toBeNull();

    // teacher-only preview vzkaz vrátí, ale reveal NEPROVEDE
    const preview = unwrap(
      await api()
        .get(`/campaigns/progress/${successor.id}/predecessor-message`)
        .set('Authorization', auth(teacherToken))
        .expect(200),
    );
    expect(preview.message).toContain('budoucí třído');
    detail = await getDetail(successor.id);
    expect(detail.predecessorMessage).toBeNull();

    // explicitní reveal → od té chvíle je vzkaz v detailu (idempotentní)
    await api()
      .post(`/campaigns/progress/${successor.id}/predecessor-message/reveal`)
      .set('Authorization', auth(teacherToken))
      .expect(201);
    await api()
      .post(`/campaigns/progress/${successor.id}/predecessor-message/reveal`)
      .set('Authorization', auth(teacherToken))
      .expect(201);
    detail = await getDetail(successor.id);
    expect(detail.predecessorMessage.message).toContain('budoucí třído');
    expect(detail.predecessorMessageRevealedAt).toBeTruthy();
  });

  // Progress Výpravy založený v testu A — dohledá se přes list.
  async function currentExpeditionId(): Promise<string> {
    const list = unwrap(
      await api()
        .get(`/campaigns/progress?classSectionId=${youngClassId}`)
        .set('Authorization', auth(teacherToken))
        .expect(200),
    );
    const expedition = list.find(
      (p: { campaignId: string }) => p.campaignId === 'vyprava-svetluska',
    );
    if (!expedition) throw new Error('Expedition progress not found');
    return expedition.id;
  }
});
