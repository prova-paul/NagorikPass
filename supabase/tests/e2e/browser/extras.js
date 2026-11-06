async (page) => {
  const log = []; const B='/Users/nagorik/Desktop/NagorikPass/supabase/tests/e2e/browser/';
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) });
  const go = async (u) => { await page.goto('http://localhost:3100' + u); await page.waitForLoadState('networkidle') };
  const login = async (e, p, home) => { await page.context().clearCookies(); await go('/login'); await page.getByLabel('Email').fill(e); await page.getByLabel('Password', { exact: true }).fill(p); await page.getByRole('button', { name: 'Sign In' }).click(); await page.waitForURL('**'+home); await page.waitForLoadState('networkidle'); };
  await page.setViewportSize({ width: 1440, height: 900 });
  await login('hr@e2e.test','E2e-admin-pass','/admin');
  await go('/admin/visitors'); await page.getByRole('button',{name:'Add expected visitor'}).click(); let d=page.getByRole('dialog');
  await d.getByLabel(/Visitor type/).selectOption('business_meeting'); await d.getByLabel(/Visitor name/).fill('Edit Me'); await d.getByLabel(/Phone number/).fill('01712000001'); await d.getByLabel(/Purpose of visit/).fill('Old purpose');
  await d.getByLabel('Scheduled arrival').fill('2026-11-10T10:00'); await d.getByLabel('Scheduled departure').fill('2026-11-10T09:00'); await d.getByRole('button',{name:'Save visitor'}).click(); await d.getByText('The departure must be after the arrival.').waitFor(); log.push('departure before arrival refused');
  await d.getByLabel('Scheduled departure').fill('2026-11-10T12:00'); await d.getByRole('button',{name:'Save visitor'}).click(); await page.waitForURL(/admin\/visitors\/[0-9a-f-]{36}/); await page.waitForLoadState('networkidle');
  log.push('scheduled shown: ' + await page.getByText('10 Nov 2026 10:00 am').count());
  await page.getByRole('button',{name:'Edit',exact:true}).click(); d=page.getByRole('dialog');
  log.push('edit form arrival: ' + await d.getByLabel('Scheduled arrival').inputValue());
  await d.getByLabel(/Purpose of visit/).fill('New purpose'); await d.getByLabel(/Visitor name/).fill('Edited Name'); await d.getByLabel(/number of guests/i).fill('3'); await d.getByRole('button',{name:'Save changes'}).click(); await d.waitFor({state:'detached'}); await page.waitForTimeout(500); await page.reload(); await page.waitForLoadState('networkidle');
  log.push('edited: ' + await page.getByText('New purpose').count() + ' name heading ' + await page.getByRole('heading',{name:'Edited Name'}).count() + ' status ' + await page.getByText('Expected').count());
  // employee edit and email lock
  await go('/admin/employees?q=Tanvir'); await page.getByRole('link',{name:'View Tanvir Rahman'}).click(); await page.waitForURL(/employees\/[0-9a-f-]{36}/); await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:'Edit',exact:true}).click(); d=page.getByRole('dialog'); log.push('no login: email editable ' + await d.getByLabel(/^Email/).isEnabled());
  await d.getByLabel(/Designation/).fill('Director'); await d.getByLabel(/Department/).fill('Sales East'); await d.getByRole('button',{name:'Save changes'}).click(); await d.waitFor({state:'detached'}); await page.waitForTimeout(500); await page.reload(); await page.waitForLoadState('networkidle'); log.push('employee edited: ' + await page.getByText('Director').count());
  await go('/admin/employees?q=Nusrat'); await page.getByRole('link',{name:'View Nusrat Jahan'}).click(); await page.waitForURL(/employees\/[0-9a-f-]{36}/); await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:'Edit',exact:true}).click(); log.push('has login: email locked ' + await page.getByRole('dialog').getByLabel(/^Email/).isDisabled()); await page.getByRole('dialog').getByRole('button',{name:'Cancel'}).click();
  // pagination, numeric order across pages, filters
  await go('/admin/cards/import'); await page.locator('input[type=file]').setInputFiles(B+'cards25.csv'); await page.getByText(/nothing has been saved/).waitFor(); await page.getByRole('button',{name:/Register 25 cards/}).click(); await page.getByText('Import finished').waitFor();
  await go('/admin/cards'); const nums=async()=> (await page.getByRole('table',{name:'Visitor cards'}).locator('tbody tr td:first-child').allInnerTexts());
  const p1=await nums(); await page.getByRole('button',{name:'Next page'}).click(); await page.waitForURL('**page=2'); await page.waitForLoadState('networkidle'); const p2=await nums(); log.push('cards p1 ' + p1.join(',') + ' | p2 ' + p2.join(','));
  await go('/admin/cards?status=issued'); log.push('issued filter empty: ' + await page.getByText('No cards match these filters.').count());
  // candidate through the whole receptionist flow, and a typed host
  await go('/admin/visitors/import'); await page.locator('input[type=file]').setInputFiles(B+'cands.csv'); await page.getByText(/nothing has been saved/).waitFor(); await page.getByRole('button',{name:/Import 2 valid/}).click(); await page.getByText('Import finished').waitFor();
  await go('/admin/visitors/import'); await page.locator('input[type=file]').setInputFiles(B+'cands.csv'); await page.getByText(/nothing has been saved/).waitFor(); await page.getByRole('button',{name:/Import 2 valid/}).click(); await page.getByText('Import finished').waitFor();
  log.push('same file twice: ' + (await page.getByTestId('import-summary').innerText()).replace(/\s+/g,' ') + ' | ' + await page.getByText(/Already expected/).count());
  await login('desk@e2e.test','E2e-desk-pass','/reception');
  await go('/reception/expected?q=Rahim'); log.push('search candidate rows: ' + await page.getByRole('table',{name:'Expected visitors'}).locator('tbody tr').count());
  await page.getByLabel('Visitor card for Rahim Candidate').selectOption({label:'009'}); await page.getByRole('button',{name:'Check in Rahim Candidate'}).click(); await page.getByRole('dialog',{name:'Checked in'}).waitFor(); await page.getByRole('button',{name:'Done'}).click();
  await go('/reception/new'); await page.getByLabel(/Visitor type/).selectOption('business_meeting'); await page.getByLabel(/Visitor name/).fill('Typed Host'); await page.getByLabel(/Phone number/).fill('01712000002'); await page.getByLabel(/Purpose of visit/).fill('Meeting');
  await page.getByRole('combobox',{name:/Invited by/}).fill('zzzz'); await page.getByText('No employee found.').waitFor(); await page.getByLabel(/Not in the list/).fill('Confirmed By HR');
  await page.getByLabel('Visitor card',{exact:true}).selectOption({label:'010'}); await page.getByRole('button',{name:'Register and check in'}).click(); await page.waitForURL('**/reception'); await page.waitForLoadState('networkidle');
  for (const n of ['Rahim Candidate','Typed Host']) { await page.getByRole('button',{name:'Check out '+n}).click(); await page.getByRole('dialog',{name:'Did you get the visitor card back?'}).getByRole('button',{name:'Yes',exact:true}).click(); await page.getByRole('dialog').waitFor({state:'detached'}); await page.waitForTimeout(600); }
  log.push('both checked out: ' + (await page.locator('[data-stat-value]').allInnerTexts()).join(','));
  await login('hr@e2e.test','E2e-admin-pass','/admin');
  await go('/admin/history'); log.push('history: ' + (await page.getByRole('table',{name:'Visit history'}).locator('tbody tr').allInnerTexts()).map(x=>x.replace(/\s+/g,' ')).join(' || '));
  await go('/admin/history?q=Typed'); log.push('history search rows: ' + await page.getByRole('table',{name:'Visit history'}).locator('tbody tr').count());
  // host deactivated keeps the name
  await go('/admin/employees?q=Nusrat'); log.push('errors: ' + JSON.stringify(errors));
  return log;
}
