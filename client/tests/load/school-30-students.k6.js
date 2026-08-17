import http from 'k6/http';
import { check, fail } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const manifest = JSON.parse(open('../scenarios/.manifest.json'));

const students = new SharedArray('8.A students', () => manifest.students8A.slice());

if (students.length !== 30) {
  throw new Error(`Expected exactly 30 students in 8.A, got ${students.length}`);
}

const persistedFinalValue = new Rate('school_persisted_final_value');
const loginDuration = new Trend('school_login_duration', true);
const sessionDuration = new Trend('school_test_session_duration', true);
const autosaveDuration = new Trend('school_autosave_duration', true);

export const options = {
  scenarios: {
    class_bell_8a: {
      executor: 'per-vu-iterations',
      vus: 30,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    school_login_duration: ['p(95)<1500'],
    school_test_session_duration: ['p(95)<1500'],
    school_autosave_duration: ['p(95)<1500'],
    school_persisted_final_value: ['rate==1'],
  },
};

function json(response, label) {
  try {
    return response.json();
  } catch (error) {
    fail(`${label}: invalid JSON status=${response.status} body=${String(response.body).slice(0, 300)} error=${error}`);
  }
}

function unwrap(response, label) {
  const parsed = json(response, label);
  if (parsed && typeof parsed === 'object' && parsed.success === false) {
    fail(`${label}: API envelope failure status=${response.status} error=${JSON.stringify(parsed)}`);
  }
  return parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'data')
    ? parsed.data
    : parsed;
}

function requestHeaders(csrf) {
  return {
    'Content-Type': 'application/json',
    'x-org-id': manifest.orgId,
    'x-cid': `school-load-vu-${__VU}-${Date.now()}`,
    ...(csrf ? { 'x-csrf-token': csrf } : {}),
  };
}

function csrfFromJar() {
  const cookies = http.cookieJar().cookiesForURL(BASE_URL);
  const values = cookies.ss_csrf;
  return Array.isArray(values) ? values[0] : values;
}

export default function () {
  const email = students[__VU - 1];
  if (!email) fail(`No deterministic 8.A account mapped to VU ${__VU}`);

  // Real schools commonly NAT an entire classroom (or the whole school) behind
  // one public IPv4 address. Every VU therefore deliberately presents the same
  // upstream address. A school-ready login policy must protect brute-force paths
  // without locking out legitimate distinct accounts at the bell.
  const schoolPublicIp = '203.0.113.42';

  const login = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email,
      password: manifest.password,
      organizationId: manifest.orgId,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': schoolPublicIp,
        'x-cid': `school-load-login-${__VU}`,
      },
      tags: { name: 'POST /api/auth/login' },
    },
  );
  loginDuration.add(login.timings.duration);
  check(login, {
    '30-student login succeeds': (r) => r.status === 200 || r.status === 201,
    'legitimate school NAT login is never throttled': (r) => r.status !== 429,
  });
  if (login.status === 429) {
    fail(`Student ${__VU} was throttled behind the shared school NAT address. Login throttling is not classroom-safe.`);
  }
  if (login.status < 200 || login.status >= 300) {
    fail(`Login failed for ${email}: status=${login.status} body=${String(login.body).slice(0, 300)}`);
  }

  const csrf = csrfFromJar();
  if (!csrf) fail(`Login for ${email} did not establish ss_csrf cookie`);

  const overview = http.get(`${BASE_URL}/api/assignments/overview`, {
    headers: requestHeaders(),
    tags: { name: 'GET /api/assignments/overview' },
  });
  check(overview, { 'assignment overview loads': (r) => r.status === 200 });
  if (overview.status !== 200) {
    fail(`Overview failed for ${email}: status=${overview.status} body=${String(overview.body).slice(0, 300)}`);
  }
  const overviewData = unwrap(overview, 'assignment overview');
  const active = Array.isArray(overviewData.active) ? overviewData.active : [];
  check(active, {
    'seeded 8.A assignment is visible': (items) =>
      items.some((item) => item.assignmentId === manifest.assignment8AId),
  });
  if (!active.some((item) => item.assignmentId === manifest.assignment8AId)) {
    fail(`Seeded assignment ${manifest.assignment8AId} is not active for ${email}`);
  }

  const session = http.get(
    `${BASE_URL}/api/assignments/${manifest.assignment8AId}/test-session`,
    {
      headers: requestHeaders(),
      tags: { name: 'GET /api/assignments/:id/test-session' },
    },
  );
  sessionDuration.add(session.timings.duration);
  check(session, { 'test session bootstraps': (r) => r.status === 200 });
  if (session.status !== 200) {
    fail(`Test session failed for ${email}: status=${session.status} body=${String(session.body).slice(0, 300)}`);
  }

  const sessionData = unwrap(session, 'test session');
  const submissionId = sessionData?.submission?.id;
  const questionId = sessionData?.test?.questions?.[0]?.id;
  if (!submissionId || !questionId) {
    fail(`Test session for ${email} did not return submission/question ids: ${JSON.stringify(sessionData).slice(0, 500)}`);
  }

  const firstValue = `load-vu-${__VU}-v1`;
  const finalValue = `load-vu-${__VU}-v2`;

  const autosave1 = http.patch(
    `${BASE_URL}/api/submissions/${submissionId}/responses`,
    JSON.stringify({
      responses: [{ questionId, givenText: firstValue }],
      clientVersion: 1,
    }),
    {
      headers: requestHeaders(csrf),
      tags: { name: 'PATCH /api/submissions/:id/responses' },
    },
  );
  autosaveDuration.add(autosave1.timings.duration);
  check(autosave1, { 'first autosave succeeds': (r) => r.status >= 200 && r.status < 300 });
  if (autosave1.status < 200 || autosave1.status >= 300) {
    fail(`First autosave failed for ${email}: status=${autosave1.status} body=${String(autosave1.body).slice(0, 300)}`);
  }

  // Same questionId on purpose: the production contract says autosave is
  // idempotent per question, so this must update rather than duplicate.
  const autosave2 = http.patch(
    `${BASE_URL}/api/submissions/${submissionId}/responses`,
    JSON.stringify({
      responses: [{ questionId, givenText: finalValue }],
      clientVersion: 2,
    }),
    {
      headers: requestHeaders(csrf),
      tags: { name: 'PATCH /api/submissions/:id/responses' },
    },
  );
  autosaveDuration.add(autosave2.timings.duration);
  check(autosave2, { 'replacement autosave succeeds': (r) => r.status >= 200 && r.status < 300 });
  if (autosave2.status < 200 || autosave2.status >= 300) {
    fail(`Replacement autosave failed for ${email}: status=${autosave2.status} body=${String(autosave2.body).slice(0, 300)}`);
  }

  const readBack = http.get(`${BASE_URL}/api/submissions/${submissionId}`, {
    headers: requestHeaders(),
    tags: { name: 'GET /api/submissions/:id' },
  });
  check(readBack, { 'submission read-back succeeds': (r) => r.status === 200 });
  if (readBack.status !== 200) {
    persistedFinalValue.add(false);
    fail(`Read-back failed for ${email}: status=${readBack.status} body=${String(readBack.body).slice(0, 300)}`);
  }

  const readBackData = unwrap(readBack, 'submission read-back');
  const responses = Array.isArray(readBackData?.responses) ? readBackData.responses : [];
  const matching = responses.filter((response) => response.questionId === questionId);
  const persisted = matching.length === 1 && matching[0].givenText === finalValue;
  persistedFinalValue.add(persisted);
  check({ matching, finalValue }, {
    'autosave converges to one final response': (state) =>
      state.matching.length === 1 && state.matching[0].givenText === state.finalValue,
  });
}

export function handleSummary(data) {
  return {
    'test-results/k6-school-30-students-summary.json': JSON.stringify(data, null, 2),
    stdout: `\nSchool 30-student certification complete: checks=${data.metrics.checks?.values?.rate ?? 'n/a'} failed=${data.metrics.http_req_failed?.values?.rate ?? 'n/a'} p95=${data.metrics.http_req_duration?.values?.['p(95)'] ?? 'n/a'}ms\n`,
  };
}
