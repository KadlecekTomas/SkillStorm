# SkillStorm Demo Runbook

## Demo Credentials

- Director: `director@zs.demo.local` / `Password123!`
- Teacher: `teacher1@zs.demo.local` / `Password123!`
- Student: `student-d@zs.demo.local` / `Password123!`

## Demo Invite Codes

- Student org invite: `DEMO-STUDENT`
- Teacher org invite: `DEMO-TEACHER`
- Class invite (8.A): `DEMO-8A`

## Demo URLs

- App login: `http://localhost:3000/login`
- Teacher tests: `http://localhost:3000/app/tests`
- Teacher assignments: `http://localhost:3000/app/assignments`
- Student assignments: `http://localhost:3000/app/assignments`

## Seeded Demo Data

- Organization: `SkillStorm Demo School`
- Academic year: current school year
- Class: `8.A Demo`
- Test: `Demo test: Zlomky a logika`
- Assignment: open immediately, closes in 7 days, `maxAttempts=1`
- Director has active organization context for settings / invite demo

## 2-Minute Guided Flow

### 1. Director / teacher view (about 45 seconds)

1. Open `http://localhost:3000/login`.
2. Log in as `director@zs.demo.local` if you want to show settings + invites, or as `teacher1@zs.demo.local` if you want to go straight to tests.
3. You should land in the school workspace.
4. Optional director step:
   - open `http://localhost:3000/app/settings`
   - verify invite section is prefilled and usable
   - use code `DEMO-STUDENT` or `DEMO-8A` for onboarding demonstration
5. Open `http://localhost:3000/app/tests`.
6. Verify the test `Demo test: Zlomky a logika` is visible.
7. Open the test detail.
8. Expected output:
   - test title is visible
   - there are 3 questions
   - the test is already published
9. Open `http://localhost:3000/app/assignments`.
10. Expected output:
   - one assignment is present for the demo class
   - the assignment window is already open

### 2. Student view (about 75 seconds)

1. Log out.
2. Log in as `student-d@zs.demo.local`.
3. Open `http://localhost:3000/app/assignments`.
4. Expected output:
   - one assignment card is visible
   - button `Otevřít test` is enabled
5. Click `Otevřít test`.
6. Click `Začít pokus`.
7. Fill the answers:
   - `Je 1/2 větší než 1/3?` -> `Ano`
   - `Kolik je 2 + 2?` -> `4`
   - `Doplň výsledek: 10 / 2 = __` -> `5`
8. Click `Dokončit`.
9. Expected output:
   - success message confirms submission
   - submission state is no longer editable
   - score is shown after evaluation

## Reset Between Demo Runs

Run the demo seed again. It is idempotent and resets the demo student's submission so the one-attempt flow stays reproducible.

```bash
cd /Users/tomaskadlecek/Documents/GitHub/SkillStorm/server
DEMO_SEED=1 npm run db:seed
```


docker compose --profile dev up --build
docker compose --profile down
