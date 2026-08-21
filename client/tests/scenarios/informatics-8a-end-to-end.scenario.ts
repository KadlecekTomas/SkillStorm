import { expect, test } from '@playwright/test';
import { loadManifest, storageStateFor } from './manifest';

test.describe('Informatika 8.A — real product path', () => {
  test('teacher launches from Library and student joins from Dashboard with semantic evidence', async ({
    browser,
  }) => {
    const manifest = loadManifest();
    const teacherContext = await browser.newContext({ storageState: storageStateFor('teacher') });
    const teacherPage = await teacherContext.newPage();

    const badResponses: string[] = [];
    teacherPage.on('response', (response) => {
      if (response.status() >= 400 && response.url().includes('/api/')) {
        badResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });

    // 1) Učitel musí hodinu objevit přes běžnou Knihovnu — žádná znalost /labs URL.
    await teacherPage.goto('/app/library');
    await expect(teacherPage.getByTestId('interactive-lessons-section')).toBeVisible();
    const lessonCard = teacherPage.getByTestId(`interactive-lesson-${manifest.informaticsLessonSlug}`);
    await expect(lessonCard).toContainText('Algoritmy · Robotická mise');
    await lessonCard.getByRole('link', { name: 'Připravit hodinu' }).click();

    await expect(teacherPage.getByTestId('lesson-experience-launch-page')).toBeVisible();
    await expect(teacherPage.getByRole('heading', { name: 'Algoritmy · Robotická mise' })).toBeVisible();

    // 2) Reálná 8.A z classroom structure + skutečný generic POST /classroom-sessions.
    await teacherPage.getByTestId('lesson-class-select').click();
    await teacherPage.getByRole('option', { name: /8\.A.*30 žáků/ }).click();
    await expect(teacherPage.getByTestId('lesson-mode-select')).toContainText('HYBRID');
    await teacherPage.getByTestId('lesson-launch-submit').click();

    await expect(teacherPage).toHaveURL(/\/app\/labs\/algorithm-lab\/mission-control\?session=/);
    const teacherUrl = new URL(teacherPage.url());
    const sessionId = teacherUrl.searchParams.get('session');
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i);

    // 3) Učitel spustí hodinu přes Mission Control, ne přes test helper.
    await expect(teacherPage.getByRole('heading', { name: 'Mission Control · Algorithm Lab' })).toBeVisible();
    await expect(teacherPage.getByTestId('algorithm-mission-status')).toHaveText('DRAFT');
    const startButton = teacherPage.getByRole('button', { name: /Spustit/i }).first();
    await expect(startButton).toBeVisible();
    await startButton.click();
    await expect(teacherPage.getByTestId('algorithm-mission-status')).toHaveText('RUNNING', {
      timeout: 10_000,
    });

    // 4) Druhý browser = reálný žák 8.A. Začíná na Přehledu, ne na /labs URL.
    const studentContext = await browser.newContext({ storageState: storageStateFor('student8a') });
    const studentPage = await studentContext.newPage();
    studentPage.on('response', (response) => {
      if (response.status() >= 400 && response.url().includes('/api/')) {
        badResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });

    await studentPage.goto('/app');
    const liveBanner = studentPage.getByTestId('student-active-lesson-banner');
    await expect(liveBanner).toBeVisible({ timeout: 12_000 });
    await expect(liveBanner).toContainText('Algoritmy · Robotická mise');
    await expect(liveBanner).toContainText('8.A');
    await studentPage.getByTestId('student-active-lesson-link').click();

    await expect(studentPage).toHaveURL(
      new RegExp(`/app/labs/algorithm-lab\\?session=${sessionId}`),
    );
    await expect(studentPage.getByTestId('algorithm-classroom-session-label')).toContainText(
      'Robotická mise',
      { timeout: 10_000 },
    );
    await expect(studentPage.getByTestId('algorithm-classroom-blocking-overlay')).toHaveCount(0);

    // 5) Žák udělá skutečnou misi. useClassroomActivity posílá eventy na backend.
    await studentPage.getByRole('button', { name: '↑ Krok' }).click();
    await studentPage.getByRole('button', { name: '↑ Krok' }).click();
    await studentPage.getByRole('button', { name: '↷ Vpravo' }).click();
    await studentPage.getByRole('button', { name: '↑ Krok' }).click();
    await studentPage.getByRole('button', { name: '▶ Spustit program krok po kroku' }).click();

    await expect(studentPage.getByTestId('algorithm-result')).toContainText('Algoritmus funguje.', {
      timeout: 10_000,
    });
    await expect(studentPage.getByTestId('algorithm-server-event-count')).toHaveText('6', {
      timeout: 10_000,
    });

    // 6) Teacher Mission Control musí vidět serverový PROGRAM_RUN bez refresh hacku.
    const programRuns = teacherPage.getByText('Program runs', { exact: true }).locator('..');
    await expect(programRuns).toContainText('1', { timeout: 10_000 });

    await teacherPage.screenshot({
      path: 'test-results/informatics-8a-01-teacher-mission-control.png',
      fullPage: true,
    });
    await studentPage.screenshot({
      path: 'test-results/informatics-8a-02-student-live-lesson.png',
      fullPage: true,
    });

    expect(badResponses).toEqual([]);

    await studentContext.close();
    await teacherContext.close();
  });
});
