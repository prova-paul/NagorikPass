async (page) => {
  const log = []; const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) });
  const go = async (u) => { await page.goto('http://localhost:3100' + u); await page.waitForLoadState('networkidle') };
  await page.setViewportSize({ width: 1440, height: 900 }); await page.context().clearCookies(); await go('/login');
  await page.getByLabel('Email').fill('hr@e2e.test'); await page.getByLabel('Password', { exact: true }).fill('E2e-admin-pass'); await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/admin');
  const add = async (open, type, name, phone, purpose, extra) => { await go('/admin/visitors'); await page.getByRole('button', { name: open }).click(); const d = page.getByRole('dialog'); await d.getByLabel(/Visitor type/).selectOption(type); await d.getByLabel(/Visitor name/).fill(name); await d.getByLabel(/Phone number/).fill(phone); await d.getByLabel(/Purpose of visit/).fill(purpose); if (extra) await extra(d); await d.getByRole('button', { name: 'Save visitor' }).click(); await page.waitForURL(/admin\/visitors\/[0-9a-f-]{36}/); };
  await add('Add expected visitor', 'business_meeting', 'Pre Registered', '01712345678', 'Contract signing', async (d) => { await d.getByLabel(/Company/).fill('Acme Ltd'); await d.getByRole('combobox', { name: /Invited by/ }).fill('nus'); await d.getByRole('button', { name: /Nusrat Jahan/ }).click(); });
  await add('Register VIP visit', 'vip_visit', 'VIP Delegation', '01712345679', 'Board visit', async (d) => { await d.getByLabel(/number of guests/i).fill('5'); await d.getByLabel(/Company/).fill('Gov Org'); });
  await add('Add expected visitor', 'delivery_courier', 'Courier Person', '01712345680', 'Parcel');
  await go('/admin/settings'); await page.getByLabel('Organization name').fill('Nagorik Test Org'); await page.getByLabel('HR/Admin contact name').fill('HR Desk'); await page.getByLabel('HR/Admin contact phone').fill('abc'); await page.getByRole('button', { name: 'Save settings' }).click(); await page.getByText('Enter a valid phone number').first().waitFor();
  log.push('error border: ' + await page.getByLabel('HR/Admin contact phone').evaluate(e => getComputedStyle(e).borderTopColor));
  await page.getByLabel('HR/Admin contact phone').fill('01710000000'); await page.getByRole('button', { name: 'Save settings' }).click(); await page.getByText('Settings saved.').waitFor();
  log.push('errors: ' + JSON.stringify(errors)); return log;
}
