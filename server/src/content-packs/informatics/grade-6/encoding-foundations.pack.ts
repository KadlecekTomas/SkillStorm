import type { CreateActivityVersionDto } from '@/activity-engine/dto/activity.dto';
import type {
  AuthoredLessonStage,
  AuthoredLessonVersion,
  CurriculumOutcomeRef,
  UniversalContentPack,
  UniversalLessonSpec,
} from '@/content-packs/content-pack.types';
import {
  ActivityDeliveryMode,
  LessonStageCompletionType,
  LessonStageType,
  SchoolGrade,
} from '@prisma/client';

const RVP_INFORMATICS_ENCODING: CurriculumOutcomeRef = {
  frameworkCode: 'CZ_RVP_ZV',
  outcomeExternalCode: 'INF-INF-001-ZV9-002',
  role: 'PRIMARY',
  rationale:
    'Žák porovnává způsoby reprezentace a kódování dat s ohledem na uložení nebo přenos informace.',
};

const SUPPORTED_MODES = [
  ActivityDeliveryMode.DEVICES,
  ActivityDeliveryMode.SHARED_DEVICES,
  ActivityDeliveryMode.HYBRID,
  ActivityDeliveryMode.BOARD_ONLY,
];

const accessibilityPlan = {
  keyboardPath: true,
  touchPath: true,
  reducedMotion: true,
  nonColorCues: true,
  instructionAlternative: true,
  dragAlternative: true,
};

const hardwareRequirements = {
  minDevices: 0,
  microphone: 'NONE',
  camera: 'NONE',
  webgl: 'NONE',
  pointer: 'ANY',
} as const;

const offlinePolicy = {
  mode: 'QUEUE_EVENTS',
  reconnectable: true,
  deduplicatesByEventId: true,
  maxOfflineSeconds: 900,
  fallback:
    'Pokračuj nad zadáním lokálně nebo na společné tabuli; odpovědi se odešlou po návratu připojení.',
} as const;

const privacyPlan = {
  storedData: ['selection', 'explanation', 'checkpoint'],
  rawMediaStorage: false,
  retentionPolicy: 'inherit-school-learning-evidence-policy',
};

const modePolicy = {
  DEVICES: {
    preservesObjective: true,
    evidenceEquivalent: true,
    fallback: 'Žák pokračuje na vlastním zařízení.',
  },
  SHARED_DEVICES: {
    preservesObjective: true,
    evidenceEquivalent: false,
    fallback: 'Dvojice zaznamená jednu společnou odpověď a doplní ústní zdůvodnění.',
  },
  HYBRID: {
    preservesObjective: true,
    evidenceEquivalent: true,
    fallback: 'Učitel vede společný model na tabuli a žáci odpovídají na zařízení.',
  },
  BOARD_ONLY: {
    preservesObjective: true,
    evidenceEquivalent: false,
    fallback: 'Třída rozhoduje společně a učitel zaznamená argumenty jako třídní evidenci.',
  },
};

function activityVersion(input: {
  title: string;
  kind: 'SELECT' | 'MATCH' | 'PREDICT' | 'EXPLAIN';
  prompt: string;
  content: Record<string, unknown>;
  signalType: string;
  interpretation: string;
}): CreateActivityVersionDto {
  return {
    engineKey: 'CORE_INTERACTION_V1',
    schemaVersion: 1,
    title: input.title,
    supportedModes: SUPPORTED_MODES,
    recommendedMode: ActivityDeliveryMode.DEVICES,
    interactionPrimitives: [input.kind, 'CHECKPOINT'],
    config: {
      kind: input.kind,
      prompt: input.prompt,
      content: input.content,
    },
    capabilityRequirements: {
      required: ['SEMANTIC_EVENTS', 'RECONNECTABLE', 'KEYBOARD_INPUT', 'TOUCH_INPUT'],
    },
    assetManifest: { assets: [] },
    accessibilityPlan,
    hardwareRequirements,
    modePolicy,
    privacyPlan,
    safetyPlan: {
      riskLevel: 'LOW',
      reviewLane: 'informatics-pedagogy',
      teacherGate: false,
    },
    offlinePolicy,
    evidencePlan: {
      completionIsMastery: false,
      signals: [
        {
          type: input.signalType,
          objectiveReference: RVP_INFORMATICS_ENCODING.outcomeExternalCode,
          interpretation: input.interpretation,
          rawOrDerived: 'RAW',
        },
      ],
    },
  };
}

const activities = [
  {
    shell: {
      slug: 'inf-g6-symbol-codebook',
      title: 'Stejná informace, jiný kód',
      description:
        'Žák pracuje s malou explicitně zadanou znakovou sadou a rozlišuje informaci od její reprezentace.',
    },
    version: activityVersion({
      title: 'Znaková sada: zakóduj a dekóduj',
      kind: 'MATCH',
      prompt:
        'Použij uvedenou znakovou sadu. Přiřaď znak ke kódu a potom vysvětli, co se změní, když stejnou informaci zapíšeme jiným kódem.',
      content: {
        codebook: [
          { symbol: 'A', code: '01' },
          { symbol: 'B', code: '10' },
          { symbol: 'C', code: '11' },
          { symbol: 'mezera', code: '00' },
        ],
        challenges: [
          { encoded: '01 10 00 11', expectedMeaning: 'AB C' },
          { meaning: 'CA', expectedEncoded: '11 01' },
        ],
        misconceptionChecks: [
          'Kód není samotná informace; je to dohodnutý způsob jejího zápisu.',
          'Bez znalosti pravidel kódování nemusí příjemce zápisu správně porozumět.',
        ],
      },
      signalType: 'ENCODING_CODEBOOK_MATCHED',
      interpretation:
        'Dokládá, že žák umí použít explicitní kódovací pravidlo oběma směry; samo dokončení nedokládá přenos do nové reprezentace.',
    }),
    curriculum: [RVP_INFORMATICS_ENCODING],
  },
  {
    shell: {
      slug: 'inf-g6-representation-choice',
      title: 'Která reprezentace se hodí?',
      description:
        'Žák porovnává dvě reprezentace stejné informace a rozhoduje podle účelu, přesnosti a velikosti zápisu.',
    },
    version: activityVersion({
      title: 'Volba reprezentace podle účelu',
      kind: 'SELECT',
      prompt:
        'Pro každý scénář vyber vhodnější reprezentaci. Nehledej „jednu nejlepší navždy“ — rozhoduj podle toho, co potřebujeme zachovat.',
      content: {
        scenarios: [
          {
            id: 'logo-scale',
            need: 'Jednoduché logo chceme zvětšit na plakát bez zubatých hran.',
            choices: ['mřížka barevných bodů', 'geometrické tvary a jejich parametry'],
            preferred: 'geometrické tvary a jejich parametry',
            reason:
              'Popis tvarů lze přepočítat pro jinou velikost bez pevné mřížky pixelů.',
          },
          {
            id: 'photo-detail',
            need: 'Chceme zachytit jemné barevné detaily fotografie.',
            choices: ['mřížka barevných bodů', 'jen několik geometrických tvarů'],
            preferred: 'mřížka barevných bodů',
            reason:
              'Fotografie obsahuje mnoho lokálních barevných detailů, které jednoduchý seznam tvarů nevystihne.',
          },
        ],
        reflection:
          'Stejný vizuální obsah lze popsat různými způsoby; vhodnost reprezentace závisí na účelu.',
      },
      signalType: 'REPRESENTATION_CHOICE_SUBMITTED',
      interpretation:
        'Dokládá volbu reprezentace podle zadané potřeby a připravuje argumentaci o trade-offu mezi způsoby kódování.',
    }),
    curriculum: [RVP_INFORMATICS_ENCODING],
  },
  {
    shell: {
      slug: 'inf-g6-color-model',
      title: 'Barva jako data',
      description:
        'Žák používá malý didaktický barevný model a ověřuje, že změna číselné reprezentace mění výslednou barvu.',
    },
    version: activityVersion({
      title: 'Barva není název, ale reprezentace',
      kind: 'PREDICT',
      prompt:
        'Předpověz, jak se změní výsledná barva, když upravíme jednotlivé složky modelu. Potom porovnej předpověď s výsledkem.',
      content: {
        model: 'didactic-rgb-0-3',
        note:
          'Pro výuku používáme zjednodušené hodnoty 0–3. Nejde o náhradu plného barevného modelu používaného v reálných souborech.',
        cases: [
          { from: [3, 0, 0], change: 'zvýšit modrou z 0 na 3', to: [3, 0, 3] },
          { from: [0, 3, 0], change: 'snížit zelenou z 3 na 1', to: [0, 1, 0] },
        ],
      },
      signalType: 'COLOR_MODEL_PREDICTION_SUBMITTED',
      interpretation:
        'Dokládá porozumění tomu, že barevný údaj je reprezentován hodnotami podle dohodnutého modelu.',
    }),
    curriculum: [RVP_INFORMATICS_ENCODING],
  },
  {
    shell: {
      slug: 'inf-g6-code-vs-cipher',
      title: 'Kódování není šifrování',
      description:
        'Žák rozliší reprezentaci dat od jednoduchého šifrování a pracuje pouze s bezpečným didaktickým příkladem.',
    },
    version: activityVersion({
      title: 'Rozliš kód, šifru a význam',
      kind: 'MATCH',
      prompt:
        'Přiřaď příklady ke kategoriím: význam, kódování, šifrování. U šifrování pracujeme jen s jednoduchým výukovým posunem znaků.',
      content: {
        categories: [
          {
            id: 'meaning',
            label: 'význam',
            explanation: 'To, co chceme sdělit.',
          },
          {
            id: 'encoding',
            label: 'kódování',
            explanation: 'Dohodnutý způsob reprezentace informace.',
          },
          {
            id: 'encryption',
            label: 'šifrování',
            explanation:
              'Transformace se záměrem skrýt obsah bez znalosti klíče; jednoduchý příklad zde slouží jen k pochopení principu.',
          },
        ],
        examples: [
          { value: 'A → 01 podle zadané tabulky', category: 'encoding' },
          { value: 'TAJNE → UBKOF při posunu každého písmene o 1', category: 'encryption' },
          { value: 'Sraz je v osm', category: 'meaning' },
        ],
        safetyBoundary:
          'Lekce nevytváří návod k obcházení zabezpečení a netvrdí, že jednoduchý posun znaků je bezpečné moderní šifrování.',
      },
      signalType: 'CODE_VS_CIPHER_CLASSIFIED',
      interpretation:
        'Dokládá konceptuální rozlišení reprezentace a šifrování; nejde o důkaz znalosti moderní kryptografie.',
    }),
    curriculum: [RVP_INFORMATICS_ENCODING],
  },
  {
    shell: {
      slug: 'inf-g6-checksum-detect',
      title: 'Poznáme chybu při přenosu?',
      description:
        'Žák používá jednoduchý kontrolní součet jako didaktický mechanismus detekce některých chyb při přenosu.',
    },
    version: activityVersion({
      title: 'Kontrolní součet jako detektor chyby',
      kind: 'PREDICT',
      prompt:
        'U každého přijatého balíčku rozhodni, zda jednoduchý kontrolní součet souhlasí. Potom vysvětli, co z toho můžeme a nemůžeme tvrdit.',
      content: {
        rule: 'checksum = poslední číslice součtu všech datových číslic',
        packets: [
          { data: [2, 5, 1], checksum: 8, expected: 'MATCH' },
          { data: [2, 4, 1], checksum: 8, expected: 'MISMATCH' },
          { data: [9, 9, 2], checksum: 0, expected: 'MATCH' },
        ],
        boundary:
          'Shoda tohoto jednoduchého součtu nezaručuje, že data jsou správná nebo bezpečná. Ukazuje pouze princip kontroly integrity zápisu.',
      },
      signalType: 'CHECKSUM_DECISION_SUBMITTED',
      interpretation:
        'Dokládá použití explicitního kontrolního pravidla a rozpoznání neshody; neprokazuje kryptografickou integritu.',
    }),
    curriculum: [RVP_INFORMATICS_ENCODING],
  },
  {
    shell: {
      slug: 'inf-g6-encoding-transfer-explain',
      title: 'Navrhni reprezentaci pro nový problém',
      description:
        'Transfer activity: žák vybere reprezentaci pro nový scénář a zdůvodní ji pomocí požadavků problému.',
    },
    version: activityVersion({
      title: 'Transfer: reprezentace podle požadavku',
      kind: 'EXPLAIN',
      prompt:
        'Školní robot má posílat krátké stavy „volno / obsazeno / chyba“. Navrhni jednoduchou reprezentaci tří stavů a vysvětli, proč ji příjemce dokáže jednoznačně přečíst.',
      content: {
        constraints: [
          'Musí existovat právě tři jednoznačně odlišitelné stavy.',
          'Odesílatel i příjemce musí znát stejné pravidlo.',
          'Řešení nesmí záviset pouze na barvě, aby bylo čitelné i bez barevného rozlišení.',
        ],
        acceptableExamples: ['00 / 01 / 10', 'A / B / C', '1 / 2 / 3'],
        scoringFocus: ['jednoznačnost', 'sdílené pravidlo', 'zdůvodnění podle omezení'],
      },
      signalType: 'ENCODING_TRANSFER_EXPLANATION_SUBMITTED',
      interpretation:
        'Transfer evidence: žák navrhuje vlastní jednoduchou reprezentaci a vysvětluje její vlastnosti v novém kontextu.',
    }),
    curriculum: [RVP_INFORMATICS_ENCODING],
  },
];

function stage(
  stageKey: string,
  orderIndex: number,
  stageType: LessonStageType,
  title: string,
  durationMin: number,
  options: Partial<AuthoredLessonStage> = {},
): AuthoredLessonStage {
  return {
    stageKey,
    orderIndex,
    stageType,
    title,
    durationMin,
    completionType: LessonStageCompletionType.MANUAL,
    checkpoint: false,
    required: true,
    teacherIntervention: false,
    ...options,
  };
}

function lessonVersion(input: {
  title: string;
  summary: string;
  objective: string;
  rationale: string;
  firstActivity: string;
  secondActivity: string;
  hookPrompt: string;
  discussionPrompt: string;
  reflectionPrompt: string;
}): AuthoredLessonVersion {
  return {
    schemaVersion: 1,
    title: input.title,
    summary: input.summary,
    learningObjective: input.objective,
    pedagogicalRationale: input.rationale,
    supportedModes: SUPPORTED_MODES,
    recommendedMode: ActivityDeliveryMode.DEVICES,
    estimatedDurationMin: 45,
    teacherPlan: {
      startInstructions: input.hookPrompt,
      fallbackStrategy:
        'Pokud zařízení nebo síť selžou, použij stejné reprezentace na tabuli a sbírej argumenty společně. Neprozrazuj správné řešení před predikcí.',
      discussionPrompts: [input.discussionPrompt, 'Co v našem řešení závisí na dohodě mezi odesílatelem a příjemcem?'],
      interventionPoints: [
        {
          stageKey: 'DISCUSS',
          reason: 'Porovnat odlišné strategie a odhalit záměnu informace za její reprezentaci.',
          action:
            'Zobraz dvě anonymní strategie, vyžádej argument pro každou a teprve potom pojmenuj společný princip.',
        },
      ],
    },
    hardwareRequirements,
    accessibilityPlan,
    privacyPlan,
    offlinePolicy,
    assetManifest: { assets: [] },
    stages: [
      stage('HOOK', 0, LessonStageType.HOOK, 'Problém', 4, {
        studentPrompt: input.hookPrompt,
      }),
      stage('PREDICT', 1, LessonStageType.PREDICTION, 'První rozhodnutí', 9, {
        activityRef: input.firstActivity,
        completionType: LessonStageCompletionType.ACTIVITY,
        checkpoint: true,
      }),
      stage('DISCUSS', 2, LessonStageType.TEACHER_INTERVENTION, 'Porovnej strategie', 6, {
        teacherGuidance: input.discussionPrompt,
        teacherIntervention: true,
      }),
      stage('CHALLENGE', 3, LessonStageType.CHALLENGE, 'Změněný problém', 12, {
        activityRef: input.secondActivity,
        completionType: LessonStageCompletionType.ACTIVITY,
        checkpoint: true,
      }),
      stage('REFLECT', 4, LessonStageType.REFLECTION, 'Co rozhodovalo?', 6, {
        studentPrompt: input.reflectionPrompt,
        completionType: LessonStageCompletionType.CHECKPOINT,
        checkpoint: true,
      }),
      stage('EVIDENCE', 5, LessonStageType.EVIDENCE, 'Dolož, že tomu rozumíš', 8, {
        activityRef: 'inf-g6-encoding-transfer-explain',
        completionType: LessonStageCompletionType.ACTIVITY,
        checkpoint: true,
      }),
    ],
  };
}

const lessons: UniversalLessonSpec[] = [
  {
    shell: {
      slug: 'inf-g6-encoding-01-symbols-and-codes',
      title: 'Stejná informace, jiný kód',
      description:
        '45min univerzální Lesson Experience: význam, znaková sada, kódování a dekódování bez závislosti na konkrétní škole.',
    },
    version: lessonVersion({
      title: 'Stejná informace, jiný kód',
      summary: 'Od významu přes dohodnutý kód k dekódování a transferu.',
      objective:
        'Žák odliší informaci od její reprezentace, použije zadané kódovací pravidlo oběma směry a vysvětlí potřebu sdíleného pravidla.',
      rationale:
        'Explicitní malá znaková sada dovoluje pozorovat princip kódování bez memorování konkrétní technické normy.',
      firstActivity: 'inf-g6-symbol-codebook',
      secondActivity: 'inf-g6-representation-choice',
      hookPrompt:
        'Dva týmy dostanou stejný zápis „01 10 00 11“, ale každý používá jinou tabulku. Dostanou stejnou zprávu? Proč?',
      discussionPrompt:
        'Která část zprávy je informace a která část je pouze způsob zápisu?',
      reflectionPrompt:
        'Jednou větou popiš, co musí odesílatel a příjemce sdílet, aby kódovanému zápisu rozuměli stejně.',
    }),
    curriculum: [RVP_INFORMATICS_ENCODING],
  },
  {
    shell: {
      slug: 'inf-g6-encoding-02-image-as-data',
      title: 'Obraz jako data',
      description:
        '45min univerzální Lesson Experience: barevný model a porovnání rastrového a geometrického popisu obrazu.',
    },
    version: lessonVersion({
      title: 'Obraz jako data',
      summary: 'Barevné hodnoty, obrazová reprezentace a volba formy podle účelu.',
      objective:
        'Žák vysvětlí, že obraz lze reprezentovat daty více způsoby, a vybere vhodnější reprezentaci podle zadaného účelu.',
      rationale:
        'Porovnání reprezentací rozvíjí princip kódování dat bez závislosti na konkrétním grafickém editoru nebo značce zařízení.',
      firstActivity: 'inf-g6-color-model',
      secondActivity: 'inf-g6-representation-choice',
      hookPrompt:
        'Jak může počítač uložit barvu nebo obrázek, když uvnitř nemá pastelky ani papír?',
      discussionPrompt:
        'Kdy je výhodnější popsat obraz body a kdy tvary? Co za to získáme a co ztrácíme?',
      reflectionPrompt:
        'Uveď jeden příklad, kdy bys zvolil mřížku barevných bodů, a jeden, kdy geometrický popis. Vždy přidej důvod.',
    }),
    curriculum: [RVP_INFORMATICS_ENCODING],
  },
  {
    shell: {
      slug: 'inf-g6-encoding-03-code-vs-cipher',
      title: 'Kódování není šifrování',
      description:
        '45min univerzální Lesson Experience: rozdíl mezi významem, reprezentací dat a jednoduchým didaktickým šifrováním.',
    },
    version: lessonVersion({
      title: 'Kódování není šifrování',
      summary: 'Rozlišení reprezentace a utajení informace bez falešných bezpečnostních tvrzení.',
      objective:
        'Žák rozliší běžné kódování od šifrování a vysvětlí, že účelem šifrování je omezit čitelnost bez znalosti klíče.',
      rationale:
        'Školní žáci často zaměňují kód, heslo a šifru. Bezpečný konceptuální příklad opravuje tento model bez offensive security obsahu.',
      firstActivity: 'inf-g6-code-vs-cipher',
      secondActivity: 'inf-g6-symbol-codebook',
      hookPrompt:
        'Je převod písmene A na číslo 65 automaticky šifrování? Co by muselo být jinak, aby cílem bylo obsah skutečně skrýt?',
      discussionPrompt:
        'Proč není tajemství založené pouze na tom, že příjemce nezná běžný formát, spolehlivý bezpečnostní princip?',
      reflectionPrompt:
        'Vysvětli spolužákovi rozdíl mezi kódováním a šifrováním bez použití slov „protože počítač“.',
    }),
    curriculum: [RVP_INFORMATICS_ENCODING],
  },
  {
    shell: {
      slug: 'inf-g6-encoding-04-transmission-integrity',
      title: 'Přenos dat a chyba',
      description:
        '45min univerzální Lesson Experience: jednoduchý kontrolní součet, detekce chyby a hranice toho, co kontrola dokazuje.',
    },
    version: lessonVersion({
      title: 'Přenos dat a chyba',
      summary: 'Kontrolní údaj jako princip detekce některých chyb při přenosu.',
      objective:
        'Žák použije jednoduché kontrolní pravidlo k odhalení neshody a vysvětlí, proč shoda kontrolního údaje sama nezaručuje správnost ani bezpečnost dat.',
      rationale:
        'Didaktický checksum ukazuje vztah mezi reprezentací, přenosem a kontrolou integrity bez předstírání kryptografické bezpečnosti.',
      firstActivity: 'inf-g6-checksum-detect',
      secondActivity: 'inf-g6-code-vs-cipher',
      hookPrompt:
        'Robot poslal čísla 2, 5, 1 a kontrolní údaj 8. Přijali jsme 2, 4, 1 a údaj 8. Co nám může kontrola prozradit?',
      discussionPrompt:
        'Jaký je rozdíl mezi „kontrola odhalila neshodu“ a „víme, že data jsou určitě správná“?',
      reflectionPrompt:
        'Napiš jednu věc, kterou jednoduchý kontrolní součet může odhalit, a jednu, kterou z něj tvrdit nesmíme.',
    }),
    curriculum: [RVP_INFORMATICS_ENCODING],
  },
];

export const grade6EncodingFoundationsPack: UniversalContentPack = {
  packId: 'INF_G6_ENCODING_FOUNDATIONS',
  version: 1,
  subjectCode: 'INFORMATICS',
  title: '6. ročník — základy reprezentace a kódování dat',
  description:
    'Čtyři 45min Lesson Experiences nad RVP outcome pro kódování dat. Umístění do 6. ročníku je doporučení SkillStormu; konkrétní ŠVP může lekce přesunout, rozdělit nebo použít jen část.',
  placement: {
    recommendedGrade: SchoolGrade.GRADE_6,
    compatibleGrades: [
      SchoolGrade.GRADE_6,
      SchoolGrade.GRADE_7,
      SchoolGrade.GRADE_8,
      SchoolGrade.GRADE_9,
    ],
    placementIsRecommendation: true,
  },
  activities,
  lessons,
};
