import type { SchoolCurriculumAdapter } from '@/content-packs/content-pack.types';
import { SchoolGrade } from '@prisma/client';

/**
 * FZŠ Chodovická is a source adapter, not a content fork.
 *
 * The summaries below intentionally paraphrase the public ŠVP. Exact school text
 * belongs in the versioned SchoolOutcome provenance layer during a real import.
 * Universal Lesson Experiences stay in the content pack and can be reused by any
 * school whose reviewed curriculum mapping points to the same RVP outcomes.
 */
export const fzsChodovicka2023Grade6InformaticsAdapter: SchoolCurriculumAdapter = {
  adapterId: 'FZS_CHODOVICKA_2023_INF_G6',
  schoolLabel: 'FZŠ Chodovická',
  curriculumVersionLabel: 'Škola pro život — platnost od 1. 9. 2023',
  source: {
    documentTitle:
      'Škola pro život — Školní vzdělávací program pro základní vzdělávání',
    sourceUrl:
      'https://cdn.sanity.io/files/rnavmcsp/production/e2b44c0343533ea8646ce41501a9792e4ec005e6.pdf',
    validFrom: '2023-09-01',
  },
  subjectCode: 'INFORMATICS',
  grade: SchoolGrade.GRADE_6,
  entries: [
    {
      sourceOutcomeKey: 'INF6-01',
      sourceAnchor: 'Informatika · období 2 · 6. ročník · výstup 1',
      sourceSummary:
        'Rozpoznání zakódované informace v běžném okolí a princip přenosu informace.',
      coverage: 'COVERED',
      lessonRefs: ['inf-g6-encoding-01-symbols-and-codes'],
    },
    {
      sourceOutcomeKey: 'INF6-02',
      sourceAnchor: 'Informatika · období 2 · 6. ročník · výstup 2',
      sourceSummary:
        'Použití znakové sady pro kódování a dekódování znaků.',
      coverage: 'COVERED',
      lessonRefs: ['inf-g6-encoding-01-symbols-and-codes'],
    },
    {
      sourceOutcomeKey: 'INF6-03',
      sourceAnchor: 'Informatika · období 2 · 6. ročník · výstup 3',
      sourceSummary:
        'Rozlišení přenosu dat a jednoduchého principu symetrického šifrování.',
      coverage: 'PARTIAL',
      lessonRefs: ['inf-g6-encoding-03-code-vs-cipher'],
      note:
        'Aktuální Lesson Experience spolehlivě rozlišuje kódování a šifrování, ale ještě neobsahuje dostatečný samostatný encode/decode transfer pro plné pokrytí školního výstupu.',
    },
    {
      sourceOutcomeKey: 'INF6-04',
      sourceAnchor: 'Informatika · období 2 · 6. ročník · výstup 4',
      sourceSummary:
        'Reprezentace barev v obrázku pomocí hodnot podle barevného modelu.',
      coverage: 'PARTIAL',
      lessonRefs: ['inf-g6-encoding-02-image-as-data'],
      note:
        'Barevný model je pokrytý, ale před plným coverage review chceme ještě vlastní learner-created encoding úlohu, ne pouze predikci změn hodnot.',
    },
    {
      sourceOutcomeKey: 'INF6-05',
      sourceAnchor: 'Informatika · období 2 · 6. ročník · výstup 5',
      sourceSummary:
        'Popis obrazu pomocí geometrických tvarů a porovnání způsobů reprezentace.',
      coverage: 'PARTIAL',
      lessonRefs: ['inf-g6-encoding-02-image-as-data'],
      note:
        'Volba reprezentace je pokrytá, ale žák zatím sám nekonstruuje geometrický zápis obrázku.',
    },
    {
      sourceOutcomeKey: 'INF6-06',
      sourceAnchor: 'Informatika · období 2 · 6. ročník · výstup 6',
      sourceSummary:
        'Zjednodušení zápisu a použití kontrolního údaje k odhalení neshody.',
      coverage: 'PARTIAL',
      lessonRefs: ['inf-g6-encoding-04-transmission-integrity'],
      note:
        'Kontrolní součet je pokrytý. Komprese nebo jiné zjednodušení zápisu potřebuje vlastní transfer activity.',
    },
    {
      sourceOutcomeKey: 'INF6-07',
      sourceAnchor: 'Informatika · období 2 · 6. ročník · výstup 7',
      sourceSummary: 'Binární reprezentace a základní logické operace.',
      coverage: 'GAP',
      lessonRefs: [],
      note:
        'Záměrně neoznačujeme jako pokryté. Patří do navazujícího universal packu Binary & Logic, ne do školního hacku uvnitř této lekce.',
    },
    {
      sourceOutcomeKey: 'INF6-08',
      sourceAnchor: 'Informatika · období 2 · 6. ročník · výstup 8',
      sourceSummary:
        'Odhalení chyby nebo rozporu mezi různými reprezentacemi stejných dat.',
      coverage: 'PARTIAL',
      lessonRefs: [],
      existingExperienceRefs: ['/app/labs/data-lab'],
      note:
        'Existující Data Lab řeší chyby a význam dat, ale porovnání tabulky s grafem vyžaduje ještě explicitní visualization transfer; nepřekrýváme tuto mezeru falešným COVERED.',
    },
    {
      sourceOutcomeKey: 'INF6-09',
      sourceAnchor: 'Informatika · období 2 · 6. ročník · výstup 9',
      sourceSummary: 'Vyvození odpovědi z dat uložených v tabulce.',
      coverage: 'REUSE_EXISTING',
      lessonRefs: [],
      existingExperienceRefs: ['/app/labs/data-lab'],
    },
    {
      sourceOutcomeKey: 'INF6-10',
      sourceAnchor: 'Informatika · období 2 · 6. ročník · výstup 10',
      sourceSummary:
        'Pravidla uspořádání dat, filtrování, řazení a třídění.',
      coverage: 'REUSE_EXISTING',
      lessonRefs: [],
      existingExperienceRefs: ['/app/labs/data-lab'],
      note:
        'Data Lab již obsahuje query/filter flow; samostatné řazení musí být před finálním coverage review ověřeno proti konkrétní ActivityVersion.',
    },
    {
      sourceOutcomeKey: 'INF6-11',
      sourceAnchor: 'Informatika · období 2 · 6. ročník · výstup 11',
      sourceSummary:
        'Doplňování záznamů podle pravidel a kontrola hodnot v tabulce.',
      coverage: 'REUSE_EXISTING',
      lessonRefs: [],
      existingExperienceRefs: ['/app/labs/data-lab'],
    },
    {
      sourceOutcomeKey: 'INF6-12',
      sourceAnchor: 'Informatika · období 2 · 6. ročník · výstup 12',
      sourceSummary:
        'Návrh tabulky pro evidenci dat a práce se strukturou evidence.',
      coverage: 'PARTIAL',
      lessonRefs: [],
      existingExperienceRefs: ['/app/labs/data-lab'],
      note:
        'Data Lab pracuje s pravidly a informačním systémem. Plný school-outcome mapping musí potvrdit, že žák opravdu navrhuje strukturu evidence, ne pouze opravuje hotovou tabulku.',
    },
  ],
};
