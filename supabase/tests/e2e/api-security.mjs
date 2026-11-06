#!/usr/bin/env node
// TEST ONLY. Tries to go around the screens: direct HTTP calls, as each role, to the same REST paths the browser client would use, against
// stack.mjs (real database, real row-level security). Run it against a freshly started stack:  node supabase/tests/e2e/api-security.mjs
const BASE = 'http://localhost:54399'
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  (${detail})`}`)
}
async function login(email, password) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', body: JSON.stringify({ email, password }) })
  return (await r.json()).access_token
}
const call = async (token, method, path, body, headers = {}) => {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), prefer: 'return=representation', ...headers }, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return { status: r.status, json }
}
const rpc = (token, name, args) => call(token, 'POST', `rpc/${name}`, args)
const refused = (r) => r.status === 401 || r.status === 403 || (r.status === 400 && /forbidden|permission/.test(JSON.stringify(r.json)))
const noRows = (r) => r.status === 200 && Array.isArray(r.json) && r.json.length === 0

const hr = await login('hr@e2e.test', 'E2e-admin-pass')
const desk = await login('desk@e2e.test', 'E2e-desk-pass')
const on = await login('nusrat@e2e.test', 'E2e-nusrat-pass')
const off = await login('imran@e2e.test', 'E2e-imran-pass')
const forged = `${hr.split('.').slice(0, 2).join('.')}.AAAAforged`

// Set up: one ordinary visit, one delivery visit, two cards.
const visit = (await rpc(hr, 'register_visit', { p_full_name: 'Api Visitor', p_phone: '01799000001', p_purpose: 'Probe', p_category: 'business_meeting' })).json
const delivery = (await rpc(hr, 'register_visit', { p_full_name: 'Api Courier', p_phone: '01799000002', p_purpose: 'Parcel', p_category: 'delivery_courier' })).json
const other = (await rpc(hr, 'register_visit', { p_full_name: 'Api Second', p_phone: '01799000003', p_purpose: 'Probe', p_category: 'other' })).json
const cards = (await call(hr, 'GET', 'visitor_cards?select=id,card_number,status&status=eq.available&order=card_number.asc')).json
const [c1, c2] = cards

check('a forged token is refused', (await call(forged, 'GET', 'visits?select=id')).status === 401)
check('a signed-out caller cannot read visits', refused(await call(null, 'GET', 'visits?select=id')))
check('a signed-out caller cannot read employees', refused(await call(null, 'GET', 'employees?select=id')))
check('a signed-out caller cannot register a visitor', refused(await rpc(null, 'register_visit', { p_full_name: 'X', p_phone: '017', p_purpose: 'x', p_category: 'other' })))

check('receptionist reads no private employee rows', noRows(await call(desk, 'GET', 'employees?select=official_email,phone')))
const dir = await call(desk, 'GET', 'employee_directory?select=*')
check('receptionist directory holds only id, name, team', dir.status === 200 && dir.json.length > 0 && dir.json.every((row) => Object.keys(row).sort().join() === 'full_name,id,team'))
check('receptionist cannot select an email through the directory', (await call(desk, 'GET', 'employee_directory?select=official_email')).status >= 400)
const ov = await call(desk, 'GET', 'visit_overview?select=*')
check('receptionist overview carries no email', ov.status === 200 && !JSON.stringify(ov.json).includes('@e2e.test'))
check('receptionist cannot register a card', refused(await call(desk, 'POST', 'visitor_cards', { card_number: 'API-1' })))
check('receptionist cannot change a card status', (await call(desk, 'PATCH', `visitor_cards?id=eq.${c1.id}`, { status: 'issued' })).status >= 400)
check('receptionist cannot read other profiles', (await call(desk, 'GET', 'profiles?select=id')).json.length === 1)
check('receptionist cannot change an account status', noRows(await call(desk, 'PATCH', 'profiles?role=eq.employee', { active: false })))
check('receptionist cannot change a registration permission', noRows(await call(desk, 'PATCH', 'employees?id=not.is.null', { can_register_visitors: false })))
check('receptionist cannot import employees', refused(await rpc(desk, 'import_employees', { p_rows: [{ employee_code: 'Z' }] })))
check('receptionist cannot import candidates', refused(await rpc(desk, 'import_candidates', { p_rows: [{ full_name: 'Z', phone: '01799000009' }] })))
check('receptionist cannot change settings', noRows(await call(desk, 'PATCH', 'app_settings?id=eq.true', { organization_name: 'X' })))

check('employee cannot read the card list', noRows(await call(on, 'GET', 'visitor_cards?select=id')))
check('employee cannot read card history', noRows(await call(on, 'GET', 'card_assignments?select=id')))
check('employee cannot read other employees', (await call(on, 'GET', 'employees?select=id')).json.length === 1)
check('employee cannot switch their own permission', noRows(await call(off, 'PATCH', 'employees?id=not.is.null', { can_register_visitors: true })))
check('employee with permission off cannot register, even directly', /visitor_registration_not_permitted/.test(JSON.stringify(await rpc(off, 'register_visit', { p_full_name: 'X', p_phone: '01799000004', p_purpose: 'x', p_category: 'other' }))))
check('employee cannot check a visitor in', refused(await rpc(on, 'check_in_visit', { p_visit_id: visit, p_card_ids: [c1.id] })))
check('employee cannot promote themselves', (await call(on, 'PATCH', 'profiles?id=not.is.null', { role: 'admin' })).status >= 400)
check('employee cannot read visits of others', !JSON.stringify((await call(on, 'GET', 'visit_overview?select=visitor_name')).json).includes('Api Visitor'))

check('HR/Admin cannot check a visitor in (the receptionist does)', refused(await rpc(hr, 'check_in_visit', { p_visit_id: visit, p_card_ids: [c1.id] })))
check('HR/Admin cannot change a login role', (await call(hr, 'PATCH', 'profiles?email=eq.desk@e2e.test', { role: 'admin' })).status >= 400)
check('HR/Admin cannot create a login directly', (await call(hr, 'POST', 'profiles', { id: visit, role: 'admin', full_name: 'X' })).status >= 400)
check('HR/Admin cannot switch off an HR/Admin account', /admin_account/.test(JSON.stringify(await call(hr, 'PATCH', 'profiles?email=eq.hr@e2e.test', { active: false }))))
check('nobody can set a visit status directly', (await call(hr, 'PATCH', `visits?id=eq.${visit}`, { status: 'checked_out' })).status >= 400)
check('nobody can write card history directly', (await call(hr, 'POST', 'card_assignments', { card_id: c1.id, visit_id: visit })).status >= 400)

check('delivery cannot be checked in, even directly', /delivery_not_permitted/.test(JSON.stringify(await rpc(desk, 'check_in_visit', { p_visit_id: delivery, p_card_ids: [c1.id] }))))
check('check-in needs a card', /card_required/.test(JSON.stringify(await rpc(desk, 'check_in_visit', { p_visit_id: visit, p_card_ids: [] }))))
const racers = await Promise.all([rpc(desk, 'check_in_visit', { p_visit_id: visit, p_card_ids: [c1.id] }), rpc(desk, 'check_in_visit', { p_visit_id: other, p_card_ids: [c1.id] })])
check('two simultaneous check-ins for one card: exactly one wins', racers.filter((r) => r.status === 200).length === 1 && /card_unavailable/.test(JSON.stringify(racers)))
const winner = racers[0].status === 200 ? visit : other
const loser = winner === visit ? other : visit
check('an Issued card cannot go to another visitor', /card_unavailable/.test(JSON.stringify(await rpc(desk, 'check_in_visit', { p_visit_id: loser, p_card_ids: [c1.id] }))))
check('a checked-in visitor cannot be checked in twice', /invalid_visit_state/.test(JSON.stringify(await rpc(desk, 'check_in_visit', { p_visit_id: winner, p_card_ids: [c2.id] }))))
const no = await rpc(desk, 'check_out_visit', { p_visit_id: winner, p_card_returned: false })
const state = async () => ({ visit: (await call(hr, 'GET', `visits?select=status,checked_out_at&id=eq.${winner}`)).json[0], card: (await call(hr, 'GET', `visitor_cards?select=status&id=eq.${c1.id}`)).json[0] })
let now = await state()
check('answering No: not completed, still Checked In, card still Issued', no.json.completed === false && now.visit.status === 'checked_in' && !now.visit.checked_out_at && now.card.status === 'issued')
check('check-out cannot skip the question', /confirmation_required/.test(JSON.stringify(await rpc(desk, 'check_out_visit', { p_visit_id: winner, p_card_returned: null }))))
const yes = await rpc(desk, 'check_out_visit', { p_visit_id: winner, p_card_returned: true })
now = await state()
check('answering Yes: completed, Checked Out, card Available', yes.json.completed === true && now.visit.status === 'checked_out' && !!now.visit.checked_out_at && now.card.status === 'available')
const history = (await call(hr, 'GET', `card_assignments?select=issued_at,returned_at&visit_id=eq.${winner}`)).json
check('card history keeps both times', history.length === 1 && !!history[0].issued_at && !!history[0].returned_at)
check('card history cannot be deleted', (await call(hr, 'DELETE', `card_assignments?visit_id=eq.${winner}`)).status >= 400 || (await call(hr, 'GET', `card_assignments?select=id&visit_id=eq.${winner}`)).json.length === 1)
check('public self-registration is refused by the stand-in, as the hosted setting must', (await fetch(`${BASE}/auth/v1/signup`, { method: 'POST', body: '{}' })).status === 422)

const failed = results.filter((ok) => !ok).length
console.log(failed ? `FAILED: ${failed} of ${results.length}` : `PASSED: ${results.length} checks`)
process.exit(failed ? 1 : 0)
