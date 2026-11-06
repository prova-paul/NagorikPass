async (page) => {
  const R='/Users/nagorik/Desktop/NagorikPass/.playwright-mcp/'; const out = { pages: 0, overflow: [], contrast: {}, smallTargets: {}, unlabelled: [], errors: [] };
  page.on('pageerror', e => out.errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_ABORTED|net::/.test(m.text())) out.errors.push(page.url()+' console: ' + m.text().slice(0,160)) });
  const go = async (u) => { await page.goto('http://localhost:3100' + u); await page.waitForLoadState('networkidle') };
  const login = async (e, p, home) => { await page.context().clearCookies(); await go('/login'); await page.getByLabel('Email').fill(e); await page.getByLabel('Password', { exact: true }).fill(p); await page.getByRole('button', { name: 'Sign In' }).click(); await page.waitForURL('**'+home); await page.waitForLoadState('networkidle'); };
  const audit = () => page.evaluate(() => {
    const lum = ([r,g,b]) => { const f = (v) => { v/=255; return v<=0.03928? v/12.92 : ((v+0.055)/1.055)**2.4 }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b) };
    const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { rgb: m.slice(0,3), a: m[3] ?? 1 } };
    const blend = (fg, bg) => fg.rgb.map((v,i)=> v*fg.a + bg[i]*(1-fg.a));
    const bgOf = (el) => { const stack=[]; let e=el; while(e){ const c=parse(getComputedStyle(e).backgroundColor); if(c.a>0){stack.push(c); if(c.a===1) break;} e=e.parentElement } let base=[255,255,255]; for(const c of stack.reverse()) base=blend(c,base); return base };
    const problems = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent.trim(); const el = walker.currentNode.parentElement; if (!t || !el || seen.has(el)) continue; seen.add(el);
      const st = getComputedStyle(el); if (st.visibility==='hidden'||st.display==='none'||el.closest('script,style,[hidden],.sr-only,option')) continue;
      const r = el.getBoundingClientRect(); if (r.width<2||r.height<2) continue;
      if (el.closest('button:disabled,[aria-disabled=true]')) continue;
      const bg = bgOf(el); const fg = blend(parse(st.color), bg); const L1=lum(fg), L2=lum(bg); const ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
      const size=parseFloat(st.fontSize), bold=+st.fontWeight>=700; const need=(size>=24||(size>=18.66&&bold))?3:4.5;
      if (ratio<need) problems.push(`${ratio.toFixed(2)} "${t.slice(0,28)}" ${st.color} on rgb(${bg.map(Math.round)})`);
    }
    const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const clipped = [...document.querySelectorAll('main .overflow-x-auto')].filter(e => e.scrollWidth > e.clientWidth + 1).length;
    const small = [...document.querySelectorAll('main button:not(:disabled), main a[href], main input:not([type=hidden]):not(.sr-only), main select')].filter(e => { const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && (r.height<24 || r.width<24) && !(e.tagName==='A' && getComputedStyle(e).display==='inline') }).map(e=>(e.getAttribute('aria-label')||e.textContent||e.tagName).trim().slice(0,24));
    const unl = [...document.querySelectorAll('main input:not([type=hidden]), main select, main button')].filter(e => !(e.labels&&e.labels.length) && !e.getAttribute('aria-label') && !e.textContent.trim()).map(e=>e.tagName+':'+(e.name||e.type));
    return { over, clipped, problems, small, unl };
  });
  const roles = [
    ['hr@e2e.test','E2e-admin-pass','/admin',['/admin','/admin/visitors','/admin/visitors/import','/admin/approvals','/admin/history?status=all','/admin/cards','/admin/cards/import','/admin/employees','/admin/employees/import','/admin/receptionists','/admin/reports','/admin/reports/print','/admin/settings']],
    ['desk@e2e.test','E2e-desk-pass','/reception',['/reception','/reception/expected','/reception/new']],
    ['nusrat@e2e.test','E2e-nusrat-pass','/employee',['/employee','/employee/visitors','/employee/visitors/new']],
  ];
  for (const [w,h,tag] of [[1440,900,'d'],[768,1024,'t'],[390,844,'m']]) {
    await page.setViewportSize({ width:w, height:h });
    for (const [e,p,home,paths] of roles) {
      await login(e,p,home);
      for (const u of paths) {
        await go(u); out.pages++;
        const a = await audit();
        if (a.over>0) out.overflow.push(`${tag} ${u} page +${a.over}px`);
        if (a.clipped) out.overflow.push(`${tag} ${u} table scrolls sideways x${a.clipped}`);
        for (const c of a.problems) (out.contrast[c] ??= new Set()).add(u);
        if (a.small.length) out.smallTargets[`${tag} ${u}`] = a.small.slice(0,6);
        if (a.unl.length) out.unlabelled.push(`${u}: ${a.unl.join(',')}`);
        if (tag!=='d') await page.screenshot({ path: `${R}s-${tag}${u.replace(/[\/?=]/g,'_')}.png`, fullPage:true });
      }
    }
  }
  out.contrast = Object.fromEntries(Object.entries(out.contrast).map(([k,v])=>[k,[...v].slice(0,2)]));
  out.unlabelled=[...new Set(out.unlabelled)];
  return out;
}
