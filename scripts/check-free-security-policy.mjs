import fs from 'node:fs';

function fail(message) {
  console.error(`Free security policy violation: ${message}`);
  process.exit(1);
}

function read(path) {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch (error) {
    fail(`cannot read ${path}: ${error.message}`);
  }
}

function requireIncludes(path, content, required) {
  for (const value of required) {
    if (!content.includes(value)) {
      fail(`${path} must contain ${JSON.stringify(value)}`);
    }
  }
}

function requireExcludes(path, content, forbidden) {
  for (const value of forbidden) {
    if (content.includes(value)) {
      fail(`${path} must not contain ${JSON.stringify(value)}`);
    }
  }
}

function requireOccurrences(path, content, needle, minimum) {
  const count = content.split(needle).length - 1;
  if (count < minimum) {
    fail(`${path} must contain ${JSON.stringify(needle)} at least ${minimum} times (found ${count})`);
  }
}

if (fs.existsSync('.whitesource')) {
  fail('.whitesource must remain absent; SkillStorm uses the free security stack, not paid Mend policy');
}

const workflowPath = '.github/workflows/security-gate.yml';
const workflow = read(workflowPath);
requireIncludes(workflowPath, workflow, [
  'name: SkillStorm Security Gate',
  'name: Security Policy Integrity',
  'name: Dependency Review',
  'name: CodeQL (${{ matrix.language }})',
  'name: Trivy Repository Gate',
  'name: Security Gate',
  'actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd',
  'actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294',
  'aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25',
  'github/codeql-action/init@db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28',
  'github/codeql-action/analyze@db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28',
  'github/codeql-action/upload-sarif@db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28',
  'javascript-typescript',
  '- actions',
  'queries: security-and-quality',
  'name: Block HIGH and CRITICAL repository misconfigurations',
  'scanners: misconfig',
  'name: Inventory current HIGH and CRITICAL dependency vulnerabilities',
  'scanners: vuln',
  'severity: HIGH,CRITICAL',
  "exit-code: '0'",
  'name: Block repository secrets',
  'scanners: secret',
  'severity: UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL',
  "exit-code: '1'",
  'TRIVY_SECRET_CONFIG: trivy-secret.yaml',
  'version: v0.74.0',
  'security-events: write',
]);
requireExcludes(workflowPath, workflow, [
  'pull_request_target:',
  'continue-on-error: true',
  'permissions: write-all',
]);

const dependencyPath = '.github/dependency-review-config.yml';
const dependency = read(dependencyPath);
requireIncludes(dependencyPath, dependency, [
  'fail-on-severity: low',
  '- runtime',
  '- development',
  '- unknown',
  'vulnerability-check: true',
  'license-check: true',
  'warn-only: false',
  'show-openssf-scorecard: true',
  'show-patched-versions: true',
  'AGPL-3.0-only',
  'GPL-3.0-or-later',
]);

const secretConfigPath = 'trivy-secret.yaml';
const secretConfig = read(secretConfigPath);
requireIncludes(secretConfigPath, secretConfig, [
  'allow-rules:',
  'id: prisma-live-session-index-identifiers',
  'live_session_rounds_live_session_id_order_key',
  'live_session_participants_live_session_id_idx',
  'live_session_groups_live_session_id_label_key',
]);
requireExcludes(secretConfigPath, secretConfig, [
  'disable-rules:',
  'path:',
  'paths:',
]);

const dependabotPath = '.github/dependabot.yml';
const dependabot = read(dependabotPath);
requireIncludes(dependabotPath, dependabot, [
  'package-ecosystem: npm',
  'directory: /server',
  'directory: /client',
  'package-ecosystem: github-actions',
  'package-ecosystem: docker',
  'interval: daily',
  'timezone: Europe/Prague',
]);

const codeownersPath = '.github/CODEOWNERS';
const codeowners = read(codeownersPath);
requireIncludes(codeownersPath, codeowners, [
  '/SECURITY.md @KadlecekTomas',
  '/.github/workflows/security-gate.yml @KadlecekTomas',
  '/.github/dependency-review-config.yml @KadlecekTomas',
  '/.github/dependabot.yml @KadlecekTomas',
  '/.github/workflows/production-gate.yml @KadlecekTomas',
  '/trivy-secret.yaml @KadlecekTomas',
  '/scripts/check-free-security-policy.mjs @KadlecekTomas',
]);

const securityPolicyPath = 'SECURITY.md';
const securityPolicy = read(securityPolicyPath);
requireIncludes(securityPolicyPath, securityPolicy, [
  '# SkillStorm Security Policy',
  'Do **not** open a public issue',
  'private vulnerability reporting',
  'Report a vulnerability',
]);

const serverDockerPath = 'server/Dockerfile';
const serverDocker = read(serverDockerPath);
requireIncludes(serverDockerPath, serverDocker, [
  '--no-install-recommends',
  'USER node',
]);
requireOccurrences(serverDockerPath, serverDocker, '--no-install-recommends', 3);
requireOccurrences(serverDockerPath, serverDocker, 'USER node', 2);

const clientDockerPath = 'client/Dockerfile';
const clientDocker = read(clientDockerPath);
requireIncludes(clientDockerPath, clientDocker, [
  'USER node',
  'COPY --chown=node:node',
]);

const composePath = 'docker-compose.prod.yml';
const compose = read(composePath);
requireOccurrences(composePath, compose, 'no-new-privileges:true', 2);
requireOccurrences(composePath, compose, 'cap_drop:', 2);
requireOccurrences(composePath, compose, '- ALL', 2);

const productionPath = '.github/workflows/production-gate.yml';
const production = read(productionPath);
requireIncludes(productionPath, production, [
  'name: Enforce free security policy',
  'run: node scripts/check-free-security-policy.mjs',
]);
requireExcludes(productionPath, production, [
  'check-mend-policy.mjs',
  'Enforce maximum Mend security policy',
]);

console.log('SkillStorm free security baseline is intact.');
