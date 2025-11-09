🗓️ Policy Compliance Log — 9. 11. 2025
📊 Celkové skóre
POLICY_COMPLETION = 83 % (33 / 40)

✅ Přehled kategorií
Kategorie	Výsledek	Poznámka
Auth	100 % (6/6)	Registrace, login, rotace tokenů, logout OK
RBAC	100 % (13/13)	Oprávnění všech rolí fungují
Multitenancy	67 % (2/3)	Učitel vlastní školy má chybně 403 místo 200
Content	83 % (5/6)	Globální materiály blokovány mezi organizacemi
Tests	100 % (2/2)	Testy a vazby funkční
Submissions	25 % (1/4)	Chybí ID po vytvoření, auto-scoring a validace pokusů
Audit	75 % (3/4)	Nezaznamenává SUBMISSION_FINISH
Plans	50 % (1/2)	Škola může omylem dostat PRIVATE plán
🧠 Shrnutí stavu

Autentizace a RBAC jsou plně v souladu s politikou systému.
Chyby se týkají pouze logiky v několika servisách (Multitenancy, Submissions, Audit, Plans).

⚙️ Akční body
1️⃣ Multitenancy

 Zkontrolovat assertSameOrganization() – špatné ID porovnání (membership.organizationId vs. user.organizationId).

 Opravit HTTP kód z 500 → 403/200.

2️⃣ Content

 Povolit přístup ke ContentScope.GLOBAL napříč organizacemi.

3️⃣ Submissions

 Vrátit id po vytvoření submissionu.

 Implementovat auto-scoring (počítat správnost odpovědí).

 Povolit druhý pokus, vracet 200 místo 500.

4️⃣ Audit

 Při dokončení testu logovat SUBMISSION_FINISH do AuditLog.

5️⃣ Plans

 V subscription.service.ts přidat validaci:
if (org.type === 'SCHOOL' && plan.target === 'PRIVATE') throw new BadRequestException(...).

💾 Poznámky k verzi

Build: v4.0.8

Branch: main

Commit: doplň hash

Test command: npm run test:policy