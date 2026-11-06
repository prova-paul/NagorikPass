async (page) => {
  const log = []; const R='/Users/nagorik/Desktop/NagorikPass/.playwright-mcp/'; const shot = (n) => page.screenshot({ path: `${R}${n}.png`, fullPage: true });
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) });
  const go = async (u) => { await page.goto('http://localhost:3100' + u); await page.waitForLoadState('networkidle') };
  const login = async (e, p, home) => { await page.context().clearCookies(); await go('/login'); await page.getByLabel('Email').fill(e); await page.getByLabel('Password', { exact: true }).fill(p); await page.getByRole('button', { name: 'Sign In' }).click(); await page.waitForURL('**'+home); await page.getByRole('heading').first().waitFor(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(300); };
  await page.setViewportSize({ width: 1280, height: 860 });
  // employee permission ON
  await login('nusrat@e2e.test', 'E2e-nusrat-pass', '/employee');
  await shot('30-employee-dashboard');
  log.push('employee notif (Pre Registered visitor was HR-registered, so none expected): ' + await page.getByText(/has checked in/).count());
  await go('/admin'); log.push('employee /admin -> ' + page.url());
  await go('/reception/expected'); log.push('employee /reception/expected -> ' + page.url());
  await go('/employee/visitors/new');
  await page.getByLabel(/Visitor type/).selectOption('personal_guest'); await page.getByLabel(/Visitor name/).fill('Emp Guest'); await page.getByLabel(/Phone number/).fill('01712345690'); await page.getByLabel(/Purpose of visit/).fill('Lunch');
  await shot('31-employee-new-visitor');
  await page.getByRole('button',{name:'Save visitor'}).click();
  await page.waitForURL('**/employee/visitors'); await page.waitForLoadState('networkidle');
  await shot('32-employee-my-visitors');
  log.push('my visitors: ' + (await page.getByRole('table',{name:'My visitors'}).locator('tbody tr').allInnerTexts()).map(t=>t.replace(/\s+/g,' ')).join(' || '));
  // permission OFF
  await login('imran@e2e.test', 'E2e-imran-pass', '/employee');
  await go('/employee/visitors/new'); log.push('perm off: ' + await page.getByRole('alert').first().innerText() + ' | form fields: ' + await page.getByLabel(/Visitor name/).count());
  await shot('33-employee-permission-off');
  // receptionist checks Emp Guest in -> employee notified
  await login('desk@e2e.test', 'E2e-desk-pass', '/reception');
  await shot('27-reception-home-mobile-width-1280');
  await go('/reception/expected');
  await shot('28-expected-desktop');
  await page.getByLabel('Visitor card for Emp Guest').selectOption({label:'006'}); await page.getByRole('button',{name:'Check in Emp Guest'}).click();
  await page.getByRole('dialog',{name:'Checked in'}).waitFor(); await page.getByRole('button',{name:'Done'}).click();
  await login('nusrat@e2e.test', 'E2e-nusrat-pass', '/employee');
  log.push('employee notif after check-in: ' + (await page.getByText(/has checked in/).allInnerTexts()).join('|'));
  await shot('34-employee-notified');
  // admin
  await login('hr@e2e.test', 'E2e-admin-pass', '/admin');
  await shot('40-admin-dashboard');
  log.push('admin tiles: ' + (await page.locator('[data-stat-value]').allInnerTexts()).join(','));
  log.push('notifs: ' + (await page.getByRole('heading',{name:'Recent activity'}).locator('xpath=ancestor::section').locator('li').allInnerTexts()).map(t=>t.replace(/\s+/g,' ')).join(' || '));
  await go('/admin/cards'); await shot('41-cards');
  log.push('cards first rows: ' + (await page.getByRole('table',{name:'Visitor cards'}).locator('tbody tr').allInnerTexts()).slice(0,3).map(t=>t.replace(/\s+/g,' ')).join(' || '));
  log.push('history: ' + (await page.getByRole('table',{name:'Card history'}).locator('tbody tr').allInnerTexts()).slice(0,6).map(t=>t.replace(/\s+/g,' ')).join(' || '));
  // card import
  await go('/admin/cards/import');
  await page.locator('input[type=file]').setInputFiles('/Users/nagorik/Desktop/NagorikPass/supabase/tests/e2e/browser/cards.csv');
  await page.getByText(/nothing has been saved/).waitFor(); await shot('42-card-import-preview');
  await page.getByRole('button',{name:/Register 2 cards/}).click(); await page.getByText('Import finished').waitFor(); await shot('43-card-import-done');
  log.push('card import: ' + (await page.getByTestId('import-summary').innerText()).replace(/\s+/g,' '));
  // candidate import csv
  await go('/admin/visitors/import');
  await page.locator('input[type=file]').setInputFiles('/Users/nagorik/Desktop/NagorikPass/supabase/tests/e2e/browser/cands.csv');
  await page.getByText(/nothing has been saved/).waitFor(); await shot('44-candidate-preview');
  await page.getByRole('button',{name:/Import 2 valid/}).click(); await page.getByText('Import finished').waitFor(); await shot('45-candidate-done');
  log.push('candidate import: ' + (await page.getByTestId('import-summary').innerText()).replace(/\s+/g,' '));
  // real xlsx
  await go('/admin/visitors/import');
  await page.locator('input[type=file]').setInputFiles('/Users/nagorik/Desktop/NagorikPass/frontend/src/test/fixtures/candidates.xlsx');
  await page.getByText(/nothing has been saved/).waitFor();
  log.push('xlsx in browser: valid rows ' + await page.getByRole('table',{name:'Valid rows'}).locator('tbody tr').count() + ', row1 ' + (await page.getByRole('table',{name:'Valid rows'}).locator('tbody tr').first().innerText()).replace(/\s+/g,' '));
  // history + reports
  await go('/admin/history'); await shot('46-history');
  log.push('history rows: ' + (await page.getByRole('table',{name:'Visit history'}).locator('tbody tr').allInnerTexts()).map(t=>t.replace(/\s+/g,' ')).join(' || '));
  await go('/admin/reports'); await shot('47-reports');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button',{name:'Download PDF'}).click()]);
  await dl.saveAs(R+'report.pdf'); log.push('pdf file: ' + dl.suggestedFilename());
  await page.getByRole('link',{name:'Print view'}).click(); await page.waitForURL('**/reports/print**'); await page.waitForLoadState('networkidle'); await shot('48-report-print');
  await page.emulateMedia({ media: 'print' }); await shot('49-report-print-media'); await page.emulateMedia({ media: 'screen' });
  log.push('print has Bangla: ' + await page.getByText('রহমান').count());
  await go('/admin/approvals'); await shot('50-approvals');
  log.push('errors: ' + JSON.stringify(errors));
  return log;
}
