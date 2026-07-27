/**
 * Úklid demo účtů, které vznikly demo seedem na nasazené instanci.
 *
 * Kontext: render.yaml pouštěl demo seed s NODE_ENV=production, takže v
 * databázi mohou ležet účty s heslem 'Password123!', které je v public repu.
 * Guardy v prisma/seed-guards.js brání jejich vzniku, ale existující účty
 * neodstraní — od toho je tenhle skript.
 *
 * Spuštění (výchozí je jen výpis, nic se nemaže):
 *   DATABASE_URL='<connection string>' npx ts-node prisma/purge-demo-accounts.ts
 *
 * Smazání až po kontrole výpisu:
 *   DATABASE_URL='<connection string>' npx ts-node prisma/purge-demo-accounts.ts --yes
 *
 * Pojistky:
 *   - účet se systemRole SUPERADMIN se nikdy nemaže,
 *   - organizace se maže jen tehdy, když v ní nezůstane žádný ne-demo člen.
 */
import { PrismaClient, SystemRole } from '@prisma/client';

const prisma = new PrismaClient();

/** Doména, pod kterou zakládá účty demo seed i lokální šablony .env. */
const DEMO_DOMAIN = '@skillstorm.local';

const APPLY = process.argv.includes('--yes');

async function main(): Promise<void> {
  const dbHost = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').host;
    } catch {
      return '(nečitelný DATABASE_URL)';
    }
  })();

  console.log(`\n=== Úklid demo účtů ===`);
  console.log(`Databáze: ${dbHost}`);
  console.log(`Režim:    ${APPLY ? 'MAZÁNÍ (--yes)' : 'jen výpis (dry-run)'}\n`);

  const kandidati = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
    select: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      createdAt: true,
      memberships: {
        select: {
          role: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      },
    },
    orderBy: { email: 'asc' },
  });

  if (kandidati.length === 0) {
    console.log(`Žádný účet na ${DEMO_DOMAIN} nenalezen. Není co uklízet.\n`);
    return;
  }

  const chranene = kandidati.filter((u) => u.systemRole === SystemRole.SUPERADMIN);
  const keSmazani = kandidati.filter((u) => u.systemRole !== SystemRole.SUPERADMIN);

  console.log(`Nalezeno ${kandidati.length} účtů na ${DEMO_DOMAIN}:\n`);
  for (const u of kandidati) {
    const role = u.systemRole ? ` [systemRole=${u.systemRole}]` : '';
    const org = u.memberships
      .map((m) => `${m.organization.name} (${m.role})`)
      .join(', ');
    const stav = u.systemRole === SystemRole.SUPERADMIN ? 'PONECHÁN' : 'ke smazání';
    console.log(`  ${stav.padEnd(11)} ${u.email}${role}`);
    console.log(`              ${org || 'bez členství'} · vytvořen ${u.createdAt.toISOString()}`);
  }

  if (chranene.length > 0) {
    console.log(`\n⚠️  ${chranene.length} účet(ů) se systemRole SUPERADMIN se nemaže.`);
    console.log(`    Pokud jde o účet s veřejně známým heslem, změň mu heslo ručně.`);
  }

  // Organizace, ve kterých demo účty sedí — a jestli v nich je i někdo další.
  const orgIds = [
    ...new Set(keSmazani.flatMap((u) => u.memberships.map((m) => m.organizationId))),
  ];
  const orgSouhrn: Array<{ id: string; name: string; cizich: number }> = [];
  const demoIds = new Set(keSmazani.map((u) => u.id));

  for (const orgId of orgIds) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, memberships: { select: { userId: true } } },
    });
    if (!org) continue;
    const cizich = org.memberships.filter((m) => !demoIds.has(m.userId)).length;
    orgSouhrn.push({ id: org.id, name: org.name, cizich });
  }

  if (orgSouhrn.length > 0) {
    console.log(`\nDotčené organizace:`);
    for (const o of orgSouhrn) {
      const verdikt =
        o.cizich === 0
          ? 'ke smazání (žádný jiný člen)'
          : `PONECHÁNA — má ${o.cizich} ne-demo člen(ů)`;
      console.log(`  ${o.name}: ${verdikt}`);
    }
  }

  if (!APPLY) {
    console.log(
      `\nNic se nesmazalo. Po kontrole výpisu spusť znovu s --yes.\n`,
    );
    return;
  }

  // Organizace mažeme jen tam, kde nezůstane nikdo cizí; kaskáda odnese
  // třídy, zadání, odevzdání i pozvánky navázané na organizaci.
  let smazanychOrg = 0;
  for (const o of orgSouhrn.filter((x) => x.cizich === 0)) {
    await prisma.organization.delete({ where: { id: o.id } });
    smazanychOrg += 1;
    console.log(`🗑️  Smazána organizace ${o.name}`);
  }

  const { count } = await prisma.user.deleteMany({
    where: { id: { in: keSmazani.map((u) => u.id) } },
  });

  console.log(`\n✅ Smazáno ${count} účtů a ${smazanychOrg} organizací.`);
  console.log(`   Ponecháno: ${chranene.length} superadmin účtů.\n`);
}

main()
  .catch((e) => {
    console.error('Úklid selhal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
