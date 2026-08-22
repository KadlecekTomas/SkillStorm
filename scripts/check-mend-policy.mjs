import fs from 'node:fs';

const configPath = '.whitesource';

function fail(message) {
  console.error(`Mend policy violation: ${message}`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  fail(`cannot parse ${configPath}: ${error.message}`);
}

const expected = [
  ['scanSettings.configMode', config?.scanSettings?.configMode, 'AUTO'],
  ['scanSettings.enableLicenseViolations', config?.scanSettings?.enableLicenseViolations, true],
  ['scanSettings.enableReachability', config?.scanSettings?.enableReachability, true],
  ['scanSettings.reachabilityScanDelayHours', config?.scanSettings?.reachabilityScanDelayHours, 24],
  ['scanSettings.enableIaC', config?.scanSettings?.enableIaC, true],
  ['checkRunSettings.vulnerableCheckRunConclusionLevel', config?.checkRunSettings?.vulnerableCheckRunConclusionLevel, 'failure'],
  ['checkRunSettings.licenseCheckRunConclusionLevel', config?.checkRunSettings?.licenseCheckRunConclusionLevel, 'failure'],
  ['checkRunSettings.iacCheckRunConclusionLevel', config?.checkRunSettings?.iacCheckRunConclusionLevel, 'failure'],
  ['checkRunSettings.displayMode', config?.checkRunSettings?.displayMode, 'diff'],
  ['checkRunSettings.failOnVulnerabilityMinSeverity', config?.checkRunSettings?.failOnVulnerabilityMinSeverity, 'Low'],
  ['checkRunSettings.strictMode', config?.checkRunSettings?.strictMode, 'failOnWarning'],
  ['checkRunSettings.strictModeInfo', config?.checkRunSettings?.strictModeInfo, true],
  ['checkRunSettings.useMendCheckNames', config?.checkRunSettings?.useMendCheckNames, true],
  ['issueSettings.minSeverityLevel', config?.issueSettings?.minSeverityLevel, 'LOW'],
  ['issueSettings.issueType', config?.issueSettings?.issueType, 'VULNERABILITY'],
  ['issueSettings.displayLicenseViolations', config?.issueSettings?.displayLicenseViolations, true],
  ['issueSettings.iacIssues', config?.issueSettings?.iacIssues, true],
  ['remediateSettings.workflowRules.enabled', config?.remediateSettings?.workflowRules?.enabled, true],
  ['remediateSettings.workflowRules.minVulnerabilitySeverity', config?.remediateSettings?.workflowRules?.minVulnerabilitySeverity, 'LOW'],
  ['leastVulnerablePackageSettings.enabled', config?.leastVulnerablePackageSettings?.enabled, true],
  ['scanSettingsSAST.enableScan', config?.scanSettingsSAST?.enableScan, true],
  ['scanSettingsSAST.enableSecretsScan', config?.scanSettingsSAST?.enableSecretsScan, true],
  ['scanSettingsSAST.scanPullRequests', config?.scanSettingsSAST?.scanPullRequests, true],
  ['scanSettingsSAST.incrementalScan', config?.scanSettingsSAST?.incrementalScan, false],
  ['scanSettingsSAST.findingSuppressions', config?.scanSettingsSAST?.findingSuppressions, 'requireApproval'],
  ['checkRunSettingsSAST.checkRunConclusionLevel', config?.checkRunSettingsSAST?.checkRunConclusionLevel, 'failure'],
  ['checkRunSettingsSAST.severityThreshold', config?.checkRunSettingsSAST?.severityThreshold, 'low'],
  ['issueSettingsSAST.issueType', config?.issueSettingsSAST?.issueType, 'finding'],
  ['issueSettingsSAST.minSeverityLevel', config?.issueSettingsSAST?.minSeverityLevel, 'low'],
];

for (const [name, actual, required] of expected) {
  if (actual !== required) {
    fail(`${name} must be ${JSON.stringify(required)} (received ${JSON.stringify(actual)})`);
  }
}

const scaBranches = config?.scanSettings?.baseBranches;
const sastBranches = config?.scanSettingsSAST?.baseBranches;
if (!Array.isArray(scaBranches) || scaBranches.length !== 1 || scaBranches[0] !== 'main') {
  fail('scanSettings.baseBranches must be exactly ["main"]');
}
if (!Array.isArray(sastBranches) || sastBranches.length !== 1 || sastBranches[0] !== 'main') {
  fail('scanSettingsSAST.baseBranches must be exactly ["main"]');
}

console.log('Mend maximum-security repository policy is intact.');
