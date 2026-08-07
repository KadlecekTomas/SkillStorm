# SkillStorm — Visual QA Findings (Archive)

> **Status:** `HISTORICAL / SNAPSHOT`  
> **Original role:** visual QA nálezy nad konkrétním UI snapshotem  
> **Archived:** 2026-08-07  
> **Current product authority:** [`README.md`](./README.md) · [`roadmap/master.md`](./roadmap/master.md)

---

## Archive notice

Původní dokument zachycoval vizuální nálezy konkrétní verze UI. Takové nálezy jsou časově citlivé: po změně komponent, layoutu, design systému nebo screenshot scénáře mohou být neplatné, i když text stále vypadá přesvědčivě.

Proto aktivní větev obsahuje pouze tento archivní ukazatel. Původní detailní nálezy zůstávají dohledatelné v Git historii.

---

## Pro současnou visual QA práci

Používejte:

- aktuální komponenty a stránky na HEAD;
- real-browser Playwright scénáře;
- [`screenshots/portfolio/index.md`](./screenshots/portfolio/index.md) pro reprodukovatelnou showcase sadu;
- aktuální issue/spec k dané UI změně;
- accessibility a production gates příslušné domény.

Starý screenshot, pixel count nebo seznam UI vad není current backlog, dokud není znovu reprodukován na současném HEAD.

> **Archive invariant:** vizuální chyba musí být reprodukovatelná na aktuálním produktu; historický screenshot nebo audit ji sám o sobě nedokazuje.