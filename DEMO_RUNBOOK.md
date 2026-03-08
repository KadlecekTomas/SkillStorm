# SkillStorm Demo Runbook

## Demo Credentials

- Teacher: `teacher.demo@skillstorm.local` / `Password123!`
- Student: `student.demo@skillstorm.local` / `Password123!`

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

## 2-Minute Guided Flow

### 1. Teacher view (about 45 seconds)

1. Open `http://localhost:3000/login`.
2. Log in as `teacher.demo@skillstorm.local`.
3. You should land in the school workspace.
4. Open `http://localhost:3000/app/tests`.
5. Verify the test `Demo test: Zlomky a logika` is visible.
6. Open the test detail.
7. Expected output:
   - test title is visible
   - there are 3 questions
   - the test is already published
8. Open `http://localhost:3000/app/assignments`.
9. Expected output:
   - one assignment is present for the demo class
   - the assignment window is already open

### 2. Student view (about 75 seconds)

1. Log out.
2. Log in as `student.demo@skillstorm.local`.
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
