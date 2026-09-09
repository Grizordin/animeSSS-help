// Offline browser regression. Optional argument: boss/contribution HTML or --contribution.
// Embedded scripts, resource URLs and event handlers from the fixture are never run.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {chromium} = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '..', 'AnimeSSS_help.user.js'), 'utf8');
new vm.Script(source);
function extract(name) {
  const match = new RegExp('^([ \\t]*)(?:async )?function ' + name + '\\(', 'm').exec(source);
  if (!match) throw Error(name);
  const lines = source.slice(match.index).split(/\r?\n/);
  for (let n = 2; n <= lines.length; n++) {
    if (lines[n - 1] !== match[1] + '}') continue;
    const code = lines.slice(0, n).join('\n');
    try { new vm.Script('(' + code + ')'); return code; } catch {}
  }
  throw Error('Cannot extract ' + name);
}
const css = source.match(/globalStyle\.textContent = `([\s\S]*?)`;/)[1];
const functions = ['addNeonToCard','clearNeonFromCard','getNeonCardType','applyNeonToCard'].map(extract).join('\n');
const fallback = `<style>
.boss-page .raid-row {display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:18px}
.boss-page .raid-panel {padding:22px;min-width:0}
.boss-page .club-boost__inner {display:flex;flex-direction:column;align-items:center;min-width:0}
.boss-page .club-boost__image {width:158px;aspect-ratio:288 / 432;flex-shrink:0}
.boss-page .club-boost__image img {display:block;width:100%;height:100%;object-fit:cover}
.boss-page .club-boost__owners,.boss-page .club-boost--content .club-boost__inner > div[style] {width:100%}
@media(max-width:760px){.boss-page .raid-row {grid-template-columns:1fr}.boss-page .club-boost__image {width:130px;max-width:100%}}
@media(max-width:420px){.boss-page .club-boost__image {width:148px}}
</style><div class="raid-row"><section class="raid-panel"></section><section class="raid-panel raid-loadout"><div class="club-boost--content"><div class="club-boost__inner"><div class="club-boost__image anime-cards__item anime-cards__owned-by-user-want"><img alt="Card"></div></div><div class="club-boost__inner"><div style="display:flex">Attack</div></div></div></section></div>`;
const contributionFallback = fallback.replaceAll('boss-page','contribution-page')
  .replaceAll('raid-row','deposit-layout').replaceAll('158px','174px')
  .replaceAll('130px','152px').replaceAll('148px','168px');
const html = process.argv[2] === '--contribution' ? contributionFallback
  : process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : fallback;
(async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.evaluate(({html,css}) => {
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const styles = [...parsed.querySelectorAll('style')].map(el => el.textContent).join('\n');
      const row = parsed.querySelector('.raid-row,.deposit-layout');
      if (!row) throw Error('Missing boss/contribution layout');
      row.querySelectorAll('script,iframe,object,embed,link,style').forEach(el => el.remove());
      for (const el of [row,...row.querySelectorAll('*')]) {
        for (const attr of [...el.attributes]) {
          if (/^on/i.test(attr.name) || /^(src|srcset|href|poster)$/i.test(attr.name)) el.removeAttribute(attr.name);
        }
      }
      const root = document.createElement('div');
      root.className = row.matches('.deposit-layout') ? 'contribution-page' : 'boss-page';
      root.append(row);
      document.body.append(root);
      const style = document.createElement('style'); style.textContent = styles + '\n' + css;
      document.head.append(style);
      const card = root.querySelector('.club-boost__image');
      card.classList.remove('cv-neon-outline','cv-neon-green'); card.removeAttribute('style');
      window.neonTestActionStyles = [...root.querySelectorAll('.club-boost__inner > div[style]')]
        .map(el => ({el,style:el.getAttribute('style')}));
    }, {html,css});
    await page.addScriptTag({content: 'const neonStateMap = new WeakMap();\n' + functions});
    const results = [];
    for (const width of [1200,700,390]) {
      await page.setViewportSize({width,height:1000});
      results.push(await page.evaluate(() => {
        let passed = 0;
        const check = (value,label) => {if (!value) throw Error(label); passed++;};
        const card = document.querySelector('.club-boost__image');
        clearNeonFromCard(card);
        const baseline = card.getBoundingClientRect().width;
        check(baseline > 0 && baseline <= 174.1, 'native card width');
        // Reproduce the old defect before asserting the fix.
        card.style.position = 'relative';
        const broken = card.getBoundingClientRect().width;
        check(broken > baseline + 40, 'fixture reproduces original stretch');
        card.classList.add('cv-neon-outline','cv-neon-green');
        neonStateMap.delete(card);
        applyNeonToCard(card);
        check(!card.hasAttribute('style'), 'old inline position and empty attribute removed');
        check(Math.abs(card.getBoundingClientRect().width - baseline) < 0.1, 'legacy card restored');
        check(card.classList.contains('cv-neon-green'), 'green neon retained');
        check(getComputedStyle(card).position === 'relative', 'CSS supplies positioning');
        check(getComputedStyle(card,'::before').content !== 'none', 'neon pseudo-element retained');
        for (let i = 0; i < 3; i++) {
          clearNeonFromCard(card);
          check(!card.hasAttribute('style'), 'toggle off leaves no style attribute');
          check(Math.abs(card.getBoundingClientRect().width - baseline) < 0.1, 'toggle off width');
          applyNeonToCard(card); applyNeonToCard(card);
          check(!card.hasAttribute('style'), 'toggle on leaves no style attribute');
          check(Math.abs(card.getBoundingClientRect().width - baseline) < 0.1, 'toggle on width');
        }
        card.classList.replace('anime-cards__owned-by-user-want','anime-cards__owned-by-user');
        applyNeonToCard(card);
        check(card.classList.contains('cv-neon-orange'), 'color can change');
        check(Math.abs(card.getBoundingClientRect().width - baseline) < 0.1, 'color change preserves width');
        card.classList.replace('anime-cards__owned-by-user','anime-cards__owned-by-user-want');
        card.style.opacity = '0.9';
        clearNeonFromCard(card);
        check(card.style.opacity === '0.9', 'unrelated inline style preserved');
        card.removeAttribute('style');
        check(window.neonTestActionStyles.every(({el,style}) => el.getAttribute('style') === style), 'site action layout untouched');
        return {width:innerWidth,baseline,broken,fixed:card.getBoundingClientRect().width,passed};
      }));
    }
    console.log(JSON.stringify({result:'BOSS_NEON_OK',fixture:!!process.argv[2],passed:results.reduce((n,r)=>n+r.passed,0),results}));
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
