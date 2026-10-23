// Local-only CSS regression. No real account, site scripts or network requests.
// Optional: --compare-ref=eb87079 compares against the known 3.78 regression.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'AnimeSSS_help.user.js'), 'utf8');
new vm.Script(source);
function cssFrom(source) {
  const start = source.indexOf('  function suiteBuildLightThemeCss(){');
  const end = source.indexOf('  globalStyle.textContent += suiteBuildLightThemeCss();', start);
  assert(start >= 0 && end > start);
  const context = {};
  vm.runInNewContext(source.slice(start, end) + ';this.css=suiteBuildLightThemeCss()', context);
  return context.css;
}
const css = cssFrom(source);
assert(css.length < 45000, 'light CSS must stay bounded');
assert(!/\[style[\s*^$|~]*=/i.test(css), 'never reinstate inline-color selector matching');
assert(!/MutationObserver|setInterval|setTimeout/.test(source.slice(source.indexOf('  function suiteBuildLightThemeCss(){'), source.indexOf('  globalStyle.textContent += suiteBuildLightThemeCss();'))), 'theme CSS adds no observer or polling');
const compare = process.argv.find(arg => arg.startsWith('--compare-ref='))?.split('=')[1];
const oldCss = compare ? cssFrom(execFileSync('git', ['show', `${compare}:AnimeSSS_help.user.js`], { cwd: root, encoding: 'utf8', maxBuffer: 8000000 })) : null;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  let requests = 0;
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => { requests++; return route.abort(); });
    await page.setContent('<style>body{font:14px Arial}.tile{display:inline-block;width:100px;height:80px}</style><main>' +
      Array.from({ length: 1000 }, (_, i) => '<div class="tile" style="color:#e2e8f0;background:#0f172a"><span style="opacity:1">' + i + '</span></div>').join('') +
      '</main><div id="aw-active-tab-panel"><span>Helper</span></div><style id="theme"></style>');
    const results = await page.evaluate(({ css, oldCss }) => {
      const sheet = document.getElementById('theme'), tiles = [...document.querySelectorAll('.tile')];
      const median = numbers => [...numbers].sort((a,b) => a-b)[Math.floor(numbers.length / 2)];
      const rows = [];
      for (const dark of [false, true]) {
        document.body.className = dark ? 'dt-is-active' : '';
        const samples = { baseline: [], current: [], ...(oldCss ? { previous: [] } : {}) };
        for (let round = 0; round < 5; round++) {
          const variants = Object.keys(samples);
          if (round % 2) variants.reverse();
          for (const variant of variants) {
            sheet.textContent = variant === 'current' ? css : variant === 'previous' ? oldCss : '';
            void document.body.offsetHeight;
            const start = performance.now();
            for (let frame = 0; frame < 60; frame++) {
              for (let i = 0; i < 100; i++) tiles[i].style.transform = `translateX(${frame % 2}px)`;
              void document.body.offsetHeight;
            }
            samples[variant].push(performance.now() - start);
          }
        }
        rows.push({ dark, ...Object.fromEntries(Object.entries(samples).map(([key, values]) => [key, Math.round(median(values))])) });
      }
      return rows;
    }, { css, oldCss });
    for (const row of results) {
      // Noise allowance for shared CI/desktop CPUs, but far below the ~400ms regression.
      assert(row.current <= Math.max(row.baseline * 5, row.baseline + 80), JSON.stringify(row));
      if (oldCss) assert(row.current < row.previous / 3, 'at least 3x faster than old broad selectors: ' + JSON.stringify(row));
    }
    assert.equal(requests, 0);
    console.log('HELPER_THEME_PERFORMANCE_OK ' + JSON.stringify({ cssBytes: css.length, oldCssBytes: oldCss?.length, millisecondsPer60Updates: results }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
