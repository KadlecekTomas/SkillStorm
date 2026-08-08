import type { ProgressDashboard } from '@/lib/progress-api';

type PdfMakeRuntime = {
  vfs?: Record<string, string>;
  createPdf: (definition: unknown) => { download: (filename?: string) => void };
};

type FontModule =
  | Record<string, string>
  | { vfs?: Record<string, string>; pdfMake?: { vfs?: Record<string, string> } };

function formatNumber(value: number | null, suffix = ''): string {
  return value === null ? '—' : `${value}${suffix}`;
}

function safeFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

async function loadPdfMake(): Promise<PdfMakeRuntime> {
  const [pdfMakeModule, fontModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pdfMake = (pdfMakeModule.default ?? pdfMakeModule) as unknown as PdfMakeRuntime;
  const fonts = (fontModule.default ?? fontModule) as unknown as FontModule;
  const fontObject = fonts as {
    vfs?: Record<string, string>;
    pdfMake?: { vfs?: Record<string, string> };
  };
  const vfs =
    fontObject.vfs ??
    fontObject.pdfMake?.vfs ??
    (typeof fonts === 'object' ? (fonts as Record<string, string>) : undefined);
  if (vfs) pdfMake.vfs = vfs;
  return pdfMake;
}

export async function downloadProgressDashboardPdf(input: {
  dashboard: ProgressDashboard;
  academicYear: string;
}): Promise<void> {
  const pdfMake = await loadPdfMake();
  const generatedAt = new Date();
  const rows = input.dashboard.classes.map((item) => [
    item.classLabel,
    String(item.studentCount),
    formatNumber(item.averageGrade),
    formatNumber(item.averageCompetency),
    formatNumber(item.attendanceRate, ' %'),
    String(item.openInterventions),
    String(item.progressEntries),
  ]);

  const definition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [34, 42, 34, 42],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#0f172a' },
    info: {
      title: `SkillStorm - pokrok školy - ${input.academicYear}`,
      subject: 'Souhrnný přehled školního pokroku',
    },
    header: {
      columns: [
        { text: 'SkillStorm', bold: true, color: '#047857' },
        { text: input.academicYear, alignment: 'right', color: '#64748b' },
      ],
      margin: [34, 18, 34, 0],
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: 'Důvěrné školní údaje - pouze pro oprávněné uživatele.',
          color: '#64748b',
          fontSize: 7,
        },
        {
          text: `Strana ${currentPage} / ${pageCount}`,
          alignment: 'right',
          color: '#64748b',
          fontSize: 7,
        },
      ],
      margin: [34, 10, 34, 0],
    }),
    content: [
      { text: 'Souhrnný přehled školního pokroku', fontSize: 22, bold: true },
      {
        text: `Vytvořeno ${generatedAt.toLocaleString('cs-CZ')}`,
        color: '#64748b',
        margin: [0, 3, 0, 16],
      },
      {
        columns: [
          { text: `Žáků\n${input.dashboard.summary.studentCount}`, bold: true, fontSize: 14 },
          { text: `Průměrná známka\n${formatNumber(input.dashboard.summary.averageGrade)}`, bold: true, fontSize: 14 },
          { text: `Průměr kompetencí\n${formatNumber(input.dashboard.summary.averageCompetency)}`, bold: true, fontSize: 14 },
          { text: `Docházka\n${formatNumber(input.dashboard.summary.attendanceRate, ' %')}`, bold: true, fontSize: 14 },
          { text: `Otevřená podpora\n${input.dashboard.summary.openInterventions}`, bold: true, fontSize: 14 },
        ],
        columnGap: 12,
        margin: [0, 0, 0, 18],
      },
      { text: 'Srovnání tříd', fontSize: 14, bold: true, margin: [0, 0, 0, 7] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 48, 65, 72, 65, 70, 70],
          body: [
            ['Třída', 'Žáků', 'Známka', 'Kompetence', 'Docházka', 'Podpora', 'Zápisy'],
            ...rows,
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f1f5f9' : null),
          hLineColor: () => '#e2e8f0',
          vLineColor: () => '#e2e8f0',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      },
      {
        text: 'Poznámka: Souhrn vychází z dat dostupných ve SkillStorm v okamžiku exportu. Slouží jako podklad pro pedagogické rozhodování a nenahrazuje odborné posouzení učitele.',
        color: '#64748b',
        fontSize: 8,
        margin: [0, 18, 0, 0],
      },
    ],
  };

  pdfMake
    .createPdf(definition)
    .download(`SkillStorm-pokrok-skoly-${safeFilename(input.academicYear)}.pdf`);
}
