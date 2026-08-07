# SkillStorm Guardian — Security & Identity Contract

> **Status:** `CURRENT / IMPLEMENTED`  
> **Owner:** Engineering + Security  
> **Last verified:** 2026-08-07  
> **Scope:** bezpečnostní invarianty aktivní role `PARENT`, vztahu rodič–dítě a rodičem spuštěných žákovských relací  
> **Historical design:** původní etapové návrhy v `docs/guardian/` a `guardian-project.md` jsou zachované jako snapshoty; tento dokument popisuje současné bezpečnostní invarianty, které musí nový vývoj zachovat.

---

## 1. Hlavní invariant

> **PARENT není generická autorizační role pro přístup ke školním datům. Rodičovský přístup je relationship-scoped vůči konkrétnímu dítěti.**

SkillStorm odděluje:

1. generický organization RBAC (`PermissionKey`, `RolePermission`, `UserPermission`),
2. guardian vztah (`GuardianStudentRelation`),
3. guardian oprávnění vůči konkrétnímu dítěti (`GuardianPermissionKey`),
4. rodičem spuštěnou žákovskou relaci / provenance (`LearningSession`).

Tyto vrstvy se nesmějí sloučit do pravidla typu:

```text
role == PARENT => může číst všechny výsledky organizace
```

---

# 2. INV4 — PARENT nezískává generická RBAC oprávnění

Při aktivní organization roli `PARENT` nesmí uživatel získat generické `PermissionKey` oprávnění:

- přes role defaults,
- přes `RolePermission`,
- přes org-scoped `UserPermission`,
- přes global `UserPermission`.

Resolver musí deny provést **před** aplikací generických grantů.

To chrání i multi-role uživatele. Učitel-rodič může mít legitimní oprávnění jako `TEACHER`; po přepnutí aktivního kontextu na `PARENT` se tato generická teacher oprávnění nesmějí přenést do rodičovského kontextu.

Aktuální implementační body zahrnují zejména:

- `server/src/modules/rbac/rbac.service.ts`,
- `server/src/modules/rbac/rbac.defaults.ts`,
- `server/src/modules/rbac/rbac-policy.service.ts`,
- příslušné RBAC/guardian regresní testy.

Změna RBAC resolveru nebo active-role semantics musí tento invariant explicitně retestovat.

---

# 3. Relationship-scoped guardian access

Současná platforma obsahuje guardian relační vrstvu včetně:

- `GuardianStudentRelation` v Prisma schématu,
- `GuardianPermissionKey`,
- `server/src/guardian/guardian-access.guard.ts`,
- `server/src/guardian/guardian.service.ts`,
- `server/src/guardian/guardian.controller.ts`.

Rodičovský request vůči dítěti musí vždy ověřit alespoň:

```text
aktivní tenant / organization
        ↓
aktivní PARENT context
        ↓
GuardianStudentRelation pro konkrétní dítě
        ↓
stav vztahu + platnost
        ↓
požadovaný GuardianPermissionKey
        ↓
resource patří stejnému dítěti a tenantovi
```

`studentId` z klienta není autorizační důkaz.

---

# 4. Tenant isolation

Guardian vztah je organization-scoped.

Bezpečnostní kontrakt:

- cizí organizace nesmí získat guardian data,
- vztah z organizace A nesmí autorizovat dítě v organizaci B,
- server musí kontrolovat organization consistency vztahu/resource,
- tam, kde současný security model skrývá existenci cross-tenant objektu, zůstává odpověď `404` místo existence-leaking detailu.

Client routing nebo skrytí tlačítka není ochrana.

---

# 5. Stav a revokace vztahu

Přístup existuje jen přes aktuálně platný guardian vztah.

Revokace/expirace vztahu musí ukončit možnost dalšího relationship-scoped přístupu bez čekání na dlouhodobě cachovaný permission snapshot.

Do JWT se proto nesmí vložit kompletní guardian relationship authorization tak, aby po revokaci zůstala platná až do běžné expirace tokenu.

---

# 6. Rodičem spuštěná žákovská relace

Současná platforma obsahuje parent-initiated student session flow, včetně:

- `server/src/guardian/guardian-sessions.controller.ts`,
- `server/src/guardian/guardian-sessions.service.ts`,
- `LearningSession`/provenance dat v Prisma schématu,
- e2e coverage pro guardian sessions.

Základní invariant:

> **Rodič a dítě nikdy nesdílejí současně jednu autorizační identitu.**

Při přechodu do žákovské relace je request autorizován jako dítě/žák v explicitně omezeném learning-session kontextu. Rodičovské capability se v tomto kontextu nesmějí „vézt s sebou“.

Návrat z dítěte do rodiče nesmí být pouhá client-side změna URL nebo React state.

---

# 7. Provenance výsledku

Výsledek patří dítěti.

Pokud vznikl v rodičem spuštěné relaci, provenance musí umožnit učiteli rozlišit relevantní kontext, například:

- dítě pracovalo v relaci spuštěné guardianem,
- jaká verification policy byla použita,
- zda byla zaznamenána deklarace pomoci, pokud ji daný flow podporuje.

Provenance nesmí být interpretována jako automatický důkaz podvádění nebo jako diagnostické skóre.

`LearningSession`/provenance data jsou auditní kontext, ne druhý vlastník submission.

---

# 8. Klasifikované testy

Parent-launched flow musí mít konzervativní default pro situace, kde škola očekává samostatný klasifikovaný výkon.

Učitel/school policy rozhoduje, zda a za jakých podmínek lze konkrétní zadání z guardian flow spustit.

SkillStorm nesmí rodičem spuštěný výkon prezentovat jako „ověřeně samostatný“ jen proto, že submission technicky dokončil student membership.

---

# 9. Multi-role uživatel

Jeden uživatel může mít více organization rolí.

Autorizační rozhodnutí se řídí **aktivním role contextem**, ne unionem všech uživatelových rolí.

Zakázané:

```text
TEACHER + PARENT => permissions(TEACHER) ∪ permissions(PARENT)
```

Správně:

```text
activeRole == TEACHER -> teacher authorization
activeRole == PARENT  -> guardian relationship authorization
```

To je kritické zejména pro učitele, který má ve stejné organizaci vlastní dítě.

---

# 10. UI invarianty

Guardian UI nesmí vytvářet dojem širšího oprávnění, než jaké backend skutečně poskytuje.

Minimální pravidla:

- dítě se zobrazí pouze přes platný ověřený vztah,
- parent context nezobrazuje interní student-only prvky jako prostředek k obcházení identity,
- family UI používá lidský jazyk a nesmí leakovat interní enumy,
- přepnutí role musí být viditelné a jednoznačné,
- sourozenci na sdíleném zařízení nesmějí sdílet cached student state.

---

# 11. Audit

Bezpečnostně významné guardian akce musí být auditovatelné v rozsahu implementovaného workflow, zejména:

- vytvoření/ověření/revokace vztahu,
- změna relationship permissions,
- parent-initiated learning session start/end/revocation,
- relevantní verification/reset/security události,
- odmítnuté privilegované změny.

Audit log nenahrazuje doménový stav vztahu.

---

# 12. Privacy invarianty

- sbírat pouze data potřebná pro guardian funkci,
- parent-facing analytics nesmí bezdůvodně odhalovat dětská data nad rámec relationship permission/purpose,
- žádný třetí tracking pouze kvůli family space,
- child/session provenance se nesmí používat k automatickému psychologickému nebo podvodovému profilování,
- nové guardian telemetry typy podléhají hlavnímu [`interactive-curriculum/PRODUCTION-CONTRACT.md`](./interactive-curriculum/PRODUCTION-CONTRACT.md), pokud souvisejí s Lesson Experiences.

---

# 13. Testovací minimum při změně Guardian/RBAC

Změna se nepovažuje za bezpečnou bez regresního ověření minimálně těchto tříd scénářů:

```text
PARENT generic permission deny
PARENT + UserPermission deny
multi-role TEACHER/PARENT active-context isolation
own child allowed
foreign child denied
cross-tenant concealed/denied
revoked relation immediately denied
guardian permission missing denied
parent-launched student session identity separation
expired/revoked learning session denied
sibling shared-device state isolation
submission provenance preserved
```

Konkrétní současné test files v repozitáři jsou autoritativnější než historické počty testů v návrhových dokumentech.

---

# 14. Historické návrhy

Následující dokumenty jsou návrhové/auditní snapshoty z etap vývoje a mohou obsahovat branch názvy, tehdejší line numbers, neimplementované varianty nebo již změněné priority:

- `guardian-project.md`,
- `guardian-spec.md`,
- `guardian/etapa-a-analyza.md`,
- `guardian/etapa-b-stop2-navrh.md`,
- `guardian/etapa-c-stop3-navrh.md`.

Jejich technické rationale je hodnotné pro historii, ale nový vývoj se řídí:

1. aktuálním kódem a testy,
2. tímto security contractem,
3. [`docs/README.md`](./README.md) a Master Roadmapem,
4. vyššími security/privacy production invarianty.

---

## Final invariant

> **Guardian je relationship-scoped, deny-by-default a identity-separated. Žádná nová classroom, curriculum, analytics ani AI feature nesmí z role `PARENT` znovu udělat generický backdoor k dětským datům.**
