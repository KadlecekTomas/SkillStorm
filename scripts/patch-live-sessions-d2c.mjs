import fs from 'node:fs';

const path = 'server/src/live-sessions/live-sessions.service.ts';
let source = fs.readFileSync(path, 'utf8');

const selectAnchor = `      campaignProgressId: true,\n      testId: true,`;
if (!source.includes(selectAnchor)) throw new Error('sessionSelect anchor missing');
source = source.replace(
  selectAnchor,
  `      campaignProgressId: true,\n      sourceKind: true,\n      testId: true,`,
);

const returnAnchor = `    if (session.hostId !== ctx.membershipId) {\n      throw new ForbiddenException({\n        code: 'NOT_SESSION_HOST',\n        message: 'Bleskovku může ovládat jen učitel, který ji spustil.',\n      });\n    }\n    return session;`;
if (!source.includes(returnAnchor)) throw new Error('getOwnedSession return anchor missing');
source = source.replace(
  returnAnchor,
  `    if (session.hostId !== ctx.membershipId) {\n      throw new ForbiddenException({\n        code: 'NOT_SESSION_HOST',\n        message: 'Bleskovku může ovládat jen učitel, který ji spustil.',\n      });\n    }\n    // Legacy Bleskovka service is deliberately Test-backed only. Lesson Experience\n    // sessions use the D2-C orchestration service and must not leak into old round APIs.\n    if (session.sourceKind !== 'LEGACY_TEST' || !session.testId || !session.test) {\n      throw new NotFoundException({\n        code: 'LIVE_SESSION_NOT_FOUND',\n        message: 'Bleskovka nebyla nalezena.',\n      });\n    }\n    return {\n      ...session,\n      testId: session.testId,\n      test: session.test,\n    };`,
);

fs.writeFileSync(path, source);
console.log('Legacy LiveSession boundary patched for D2-C.');
