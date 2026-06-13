// ---------------------------------------------------------------------------
// Health playbook — deterministic, no PII, no user identifiers.
// Actions are platform-internal links or instructional text only.
// ---------------------------------------------------------------------------

export type HealthRecommendationCode =
  | 'NO_TEACHER_ACTIVITY'
  | 'NO_STUDENT_ACTIVITY'
  | 'NO_NEW_CONTENT'
  | 'LOW_INVITE_CONVERSION'
  | 'AT_RISK';

export type PlaybookAction = {
  label: string;
  /** LINK → navigate to internal platform page. TEXT → instructional note. */
  type: 'LINK' | 'TEXT';
  /** URL path for LINK (relative, platform-internal), or plain text for TEXT. */
  value: string;
};

export type PlaybookEntry = {
  title: string;
  severity: 'high' | 'medium' | 'low';
  /** Root cause explanation shown to platform admin. */
  why: string;
  actions: PlaybookAction[];
};

/**
 * Org-id placeholder used in LINK values.
 * Callers must replace `{orgId}` with the actual org UUID before serializing.
 */
export const ORG_ID_PLACEHOLDER = '{orgId}';

export const HEALTH_PLAYBOOK: Record<HealthRecommendationCode, PlaybookEntry> =
  {
    NO_TEACHER_ACTIVITY: {
      title: 'No teacher activity',
      severity: 'high',
      why: 'No teacher created a test in the last 30 days. The content pipeline is stalled — students have nothing new to work on.',
      actions: [
        {
          label: 'View org detail',
          type: 'LINK',
          value: `/app/platform/organizations/${ORG_ID_PLACEHOLDER}`,
        },
        {
          label: 'Audit: TEST_CREATE events',
          type: 'LINK',
          value: `/app/platform/audit?organizationId=${ORG_ID_PLACEHOLDER}&action=TEST_CREATE`,
        },
        {
          label:
            'Kontaktuj ředitele a ověř onboarding učitelů — možná potřebují školení nebo přihlašovací údaje.',
          type: 'TEXT',
          value:
            'Kontaktuj ředitele a ověř onboarding učitelů — možná potřebují školení nebo přihlašovací údaje.',
        },
      ],
    },

    NO_STUDENT_ACTIVITY: {
      title: 'No student activity',
      severity: 'high',
      why: 'No student submitted anything in the last 30 days. Either there are no active assignments, enrollment is missing, or students cannot log in.',
      actions: [
        {
          label: 'View org detail',
          type: 'LINK',
          value: `/app/platform/organizations/${ORG_ID_PLACEHOLDER}`,
        },
        {
          label: 'Audit: SUBMISSION events',
          type: 'LINK',
          value: `/app/platform/audit?organizationId=${ORG_ID_PLACEHOLDER}&action=SUBMISSION`,
        },
        {
          label:
            'Zkontroluj, zda jsou třídy a žáci importováni a zda existují otevřená zadání.',
          type: 'TEXT',
          value:
            'Zkontroluj, zda jsou třídy a žáci importováni a zda existují otevřená zadání.',
        },
      ],
    },

    NO_NEW_CONTENT: {
      title: 'No new tests created',
      severity: 'medium',
      why: 'No new tests were created in the last 30 days. Existing content may be exhausted, causing engagement to drop.',
      actions: [
        {
          label: 'View org detail',
          type: 'LINK',
          value: `/app/platform/organizations/${ORG_ID_PLACEHOLDER}`,
        },
        {
          label: 'Audit: TEST_CREATE events',
          type: 'LINK',
          value: `/app/platform/audit?organizationId=${ORG_ID_PLACEHOLDER}&action=TEST_CREATE`,
        },
        {
          label:
            'Ověř, zda učitelé mají přístup k tvorbě testů a zda je catalog aktivovaný.',
          type: 'TEXT',
          value:
            'Ověř, zda učitelé mají přístup k tvorbě testů a zda je catalog aktivovaný.',
        },
      ],
    },

    LOW_INVITE_CONVERSION: {
      title: 'Low invite conversion',
      severity: 'medium',
      why: 'Active invite campaigns exist but fewer than 20% of capacity was used. Links may be broken, expired, or onboarding UX is causing drop-off.',
      actions: [
        {
          label: 'Audit: STUDENT_JOINED events',
          type: 'LINK',
          value: `/app/platform/audit?organizationId=${ORG_ID_PLACEHOLDER}&action=STUDENT_JOINED`,
        },
        {
          label:
            'Zkontroluj expiraci invite odkazů a onboarding copy. Zvažte prodloužení platnosti nebo jiný komunikační kanál.',
          type: 'TEXT',
          value:
            'Zkontroluj expiraci invite odkazů a onboarding copy. Zvažte prodloužení platnosti nebo jiný komunikační kanál.',
        },
      ],
    },

    AT_RISK: {
      title: 'Organization at risk',
      severity: 'high',
      why: 'Overall health score is below 40. The organization is either in early onboarding, has lost active users, or is effectively inactive.',
      actions: [
        {
          label: 'View org detail',
          type: 'LINK',
          value: `/app/platform/organizations/${ORG_ID_PLACEHOLDER}`,
        },
        {
          label: 'Full audit log for this org',
          type: 'LINK',
          value: `/app/platform/audit?organizationId=${ORG_ID_PLACEHOLDER}`,
        },
        {
          label:
            'Zvažte přímý kontakt s ředitelem organizace pro zjištění příčiny inaktivity.',
          type: 'TEXT',
          value:
            'Zvažte přímý kontakt s ředitelem organizace pro zjištění příčiny inaktivity.',
        },
      ],
    },
  };
