async (page) => {
  const log = []; const R='/Users/nagorik/Desktop/NagorikPass/.playwright-mcp/'; const shot = (n) => page.screenshot({ path: `${R}${n}.png`, fullPage: true });
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) });
  const go = async (u) => { await page.goto('http://localhost:3100' + u); await page.waitForLoadState('networkidle') };
  const STACK='http://localhost:54399';
  const signIn = async (e, p) => { await page.context().clearCookies(); await go('/login'); await page.getByLabel('Email').fill(e); await page.getByLabel('Password', { exact: true }).fill(p); await page.getByRole('button', { name: 'Sign In' }).click(); };
  const login = async (e, p, home) => { await signIn(e, p); await page.waitForURL('**'+home); await page.getByRole('heading').first().waitFor(); await page.waitForLoadState('networkidle'); };
  const token = async (email) => (await (await page.request.get(`${STACK}/__test/invite?email=${encodeURIComponent(email)}`)).json()).token;
  await page.setViewportSize({ width: 1280, height: 860 });
  await login('hr@e2e.test', 'E2e-admin-pass', '/admin');
  await shot('60-admin-dashboard-grid');
  // Employees
  await go('/admin/employees'); await shot('61-employees');
  await page.getByRole('button',{name:'Add employee'}).click();
  let d = page.getByRole('dialog'); await d.getByRole('button',{name:'Add employee'}).click();
  log.push('required errors: ' + await d.getByText(/^Enter the /).count());
  await d.getByLabel(/Employee ID/).fill('0101'); await d.getByLabel(/Full name/).fill('Dup Person'); await d.getByLabel(/^Email/).fill('new@e2e.test');
  await d.getByRole('button',{name:'Add employee'}).click(); await d.getByText(/already used/).first().waitFor(); log.push('duplicate ID refused: ' + await d.getByText(/already used/).first().innerText());
  await d.getByLabel(/Employee ID/).fill('0099'); log.push('invite default checked: ' + await d.getByLabel(/Send an invitation/).isChecked() + ', perm default: ' + await d.getByLabel(/Can register visitors/).isChecked());
  await d.getByLabel(/Send an invitation/).check();
  await d.getByRole('button',{name:'Add employee'}).click();
  await page.waitForURL(/admin\/employees\/[0-9a-f-]{36}/); await page.waitForLoadState('networkidle'); await page.getByText('Employee ID 0099').waitFor(); await shot('62-employee-detail');
  log.push('new employee login state: ' + await page.getByText('Invited, and has not set a password yet.').count());
  // set password path: token form
  const t = await token('new@e2e.test'); log.push('invite token present: ' + !!t);
  await page.context().clearCookies();
  await go('/auth/confirm?token_hash=bad-token'); log.push('bad token -> ' + page.url() + ' | ' + (await page.getByRole('status').first().innerText()));
  await go('/auth/confirm#error=access_denied&error_code=otp_expired'); await page.waitForURL('**/login?reason=invite_invalid'); log.push('expired fragment -> login notice');
  await go('/auth/set-password'); log.push('set-password signed out -> ' + page.url());
  await go('/auth/confirm?token_hash=' + t); log.push('good token -> ' + page.url()); await shot('63-set-password');
  await page.getByLabel('New password').fill('short'); await page.getByLabel('Confirm password').fill('short'); await page.getByRole('button',{name:'Save password'}).click(); await page.getByText('Use at least 8 characters.').waitFor(); log.push('short pw refused');
  await page.getByLabel('New password').fill('New-pass-123'); await page.getByLabel('Confirm password').fill('Different-1'); await page.getByRole('button',{name:'Save password'}).click(); await page.getByText('do not match').waitFor(); log.push('mismatch refused');
  await page.getByLabel('New password').fill('New-pass-123'); await page.getByLabel('Confirm password').fill('New-pass-123'); await page.getByRole('button',{name:'Save password'}).click(); await page.waitForURL('**/employee'); log.push('password set -> ' + page.url());
  await go('/auth/set-password'); log.push('set-password when active -> ' + page.url());
  await go('/auth/confirm?token_hash=' + t); log.push('reused token -> ' + page.url());
  await login('new@e2e.test', 'New-pass-123', '/employee'); log.push('login with own password ok');
  // fragment form of invitation session
  const s = await (await page.request.post(`${STACK}/auth/v1/token?grant_type=password`, { data: { email: 'new@e2e.test', password: 'New-pass-123' } })).json();
  await page.context().clearCookies();
  await go(`/auth/confirm#access_token=${s.access_token}&refresh_token=${s.refresh_token}`); await page.waitForURL('**/employee'); log.push('fragment session -> ' + page.url() + ' (no tokens in address)');
  // Admin sees active
  await login('hr@e2e.test', 'E2e-admin-pass', '/admin');
  await go('/admin/employees?q=Dup'); log.push('employee list login: ' + (await page.getByRole('row',{name:/Dup Person/}).innerText()).replace(/\s+/g,' '));
  // Permission switch and enforcement
  await go('/admin/employees?q=Imran'); await page.getByRole('switch',{name:/Allow Imran/}).click(); await page.getByText('can now register visitors').waitFor(); log.push('permission turned ON');
  await login('imran@e2e.test', 'E2e-imran-pass', '/employee');
  await go('/employee/visitors/new'); await page.getByLabel(/Visitor type/).selectOption('other'); await page.getByLabel(/Visitor name/).fill('Imran Guest'); await page.getByLabel(/Phone number/).fill('01712345691'); await page.getByLabel(/Purpose of visit/).fill('Demo');
  // HR turns it OFF while the form is open: the database must refuse
  const hrCtx = await page.context().browser().newContext(); const hr = await hrCtx.newPage();
  await hr.goto('http://localhost:3100/login'); await hr.waitForLoadState('networkidle'); await hr.getByLabel('Email').fill('hr@e2e.test'); await hr.getByLabel('Password',{exact:true}).fill('E2e-admin-pass'); await hr.getByRole('button',{name:'Sign In'}).click(); await hr.waitForURL('**/admin');
  await hr.goto('http://localhost:3100/admin/employees?q=Imran'); await hr.waitForLoadState('networkidle'); await hr.getByRole('switch',{name:/Allow Imran/}).click(); await hr.getByText('can no longer register').waitFor();
  await page.getByRole('button',{name:'Save visitor'}).click(); await page.getByText(/not allowed to register visitors/).first().waitFor(); log.push('permission OFF while form open: refused by the database');
  await shot('64-permission-refused');
  // Deactivate employee: live session denied; login refused
  await hr.goto('http://localhost:3100/admin/employees?q=Imran'); await hr.waitForLoadState('networkidle'); await hr.getByRole('button',{name:'Deactivate'}).click(); await hr.getByRole('dialog').getByRole('button',{name:'Deactivate'}).click(); await hr.getByRole('dialog').waitFor({state:'detached'});
  await go('/employee'); log.push('deactivated live session -> ' + page.url() + ' | ' + (await page.getByRole('status').first().innerText().catch(()=>'')));
  await signIn('imran@e2e.test','E2e-imran-pass'); await page.getByText(/deactivated/).first().waitFor(); log.push('deactivated login: ' + await page.getByText(/deactivated/).first().innerText());
  await hr.getByRole('button',{name:'Reactivate'}).click(); await hr.getByRole('dialog').getByRole('button',{name:'Reactivate'}).click(); await hr.getByRole('dialog').waitFor({state:'detached'});
  await login('imran@e2e.test', 'E2e-imran-pass', '/employee'); log.push('reactivated login ok');
  // Import employees
  await hr.goto('http://localhost:3100/admin/employees/import'); await hr.waitForLoadState('networkidle');
  await hr.locator('input[type=file]').setInputFiles('/Users/nagorik/Desktop/NagorikPass/supabase/tests/e2e/browser/staff.csv'); await hr.getByText(/nothing has been saved/).waitFor();
  await hr.screenshot({path:R+'65-employee-import-preview.png',fullPage:true});
  log.push('import default perm yes: ' + await hr.getByLabel(/Yes/).isChecked() + ', invites unchecked: ' + !(await hr.getByLabel(/Send invitation emails/).isChecked()));
  await hr.getByLabel('No',{exact:true}).check();
  await hr.getByRole('button',{name:/Import 2 valid/}).click(); await hr.getByText('Import finished').waitFor();
  log.push('employee import summary: ' + (await hr.locator('[role=status].grid, div.grid').first().innerText()).replace(/\s+/g,' '));
  await hr.goto('http://localhost:3100/admin/employees?q=Imported'); await hr.waitForLoadState('networkidle');
  log.push('imported rows: ' + (await hr.getByRole('table',{name:'Employees'}).locator('tbody tr').allInnerTexts()).map(x=>x.replace(/\s+/g,' ')).join(' || '));
  log.push('imported switches: ' + (await hr.getByRole('switch').evaluateAll(a=>a.map(e=>e.getAttribute('aria-checked')))).join(','));
  // Receptionist management
  await hr.goto('http://localhost:3100/admin/receptionists'); await hr.waitForLoadState('networkidle');
  await hr.getByRole('button',{name:'Add receptionist'}).click(); let r = hr.getByRole('dialog');
  await r.getByLabel(/Full name/).fill('Mariam Desk'); await r.getByLabel(/^Email/).fill('hr@e2e.test'); await r.getByRole('button',{name:'Send invitation'}).click(); await r.getByText(/another kind of account/).first().waitFor(); log.push('email of another role refused');
  await r.getByLabel(/^Email/).fill('mariam@e2e.test'); await r.getByRole('button',{name:'Send invitation'}).click(); await r.waitFor({state:'detached'}); await hr.waitForLoadState('networkidle');
  await hr.screenshot({path:R+'66-receptionists.png',fullPage:true});
  log.push('receptionists: ' + (await hr.getByRole('table',{name:'Receptionists'}).locator('tbody tr').allInnerTexts()).map(x=>x.replace(/\s+/g,' ')).join(' || '));
  await hr.getByRole('button',{name:'Edit Mariam Desk'}).click(); r = hr.getByRole('dialog'); log.push('email locked: ' + await r.getByLabel(/^Email/).isDisabled()); await r.getByLabel(/Full name/).fill('Mariam Sultana'); await r.getByRole('button',{name:'Save changes'}).click(); await r.waitFor({state:'detached'}); await hr.getByText('Mariam Sultana').first().waitFor(); log.push('name edited');
  const mt = await token('mariam@e2e.test');
  await page.context().clearCookies(); await go('/auth/confirm?token_hash='+mt); await page.getByLabel('New password').fill('Mariam-pass-1'); await page.getByLabel('Confirm password').fill('Mariam-pass-1'); await page.getByRole('button',{name:'Save password'}).click(); await page.waitForURL('**/reception'); log.push('receptionist activated -> ' + page.url());
  await page.waitForLoadState('networkidle'); await go('/reception/expected');
  await hr.reload(); await hr.waitForLoadState('networkidle');
  await hr.getByRole('row',{name:/Mariam Sultana/}).getByRole('button',{name:'Deactivate'}).click(); await hr.getByRole('dialog').getByRole('button',{name:'Deactivate'}).click(); await hr.getByRole('dialog').waitFor({state:'detached'});
  await go('/reception'); log.push('deactivated receptionist session -> ' + page.url());
  await signIn('mariam@e2e.test','Mariam-pass-1'); await page.getByText(/deactivated/).first().waitFor(); log.push('deactivated receptionist login: ' + await page.getByText(/deactivated/).first().innerText());
  await hrCtx.close();
  log.push('errors: ' + JSON.stringify(errors));
  return log;
}
