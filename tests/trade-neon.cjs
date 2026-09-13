// Offline DOM regression; optional argument: the supplied trade inventory HTML.
// Only sanitized card elements are imported. No site scripts or requests run.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {chromium} = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '..', 'AnimeSSS_help.user.js'), 'utf8');
new vm.Script(source);
function extract(name) {
  const match = new RegExp('^([ \\t]*)function ' + name + '\\(', 'm').exec(source);
  if (!match) throw Error(name);
  const lines = source.slice(match.index).split(/\r?\n/);
  for (let n = 2; n <= lines.length; n++) {
    if (lines[n - 1] !== match[1] + '}') continue;
    const code = lines.slice(0, n).join('\n');
    try { new vm.Script('(' + code + ')'); return code; } catch {}
  }
  throw Error('Cannot extract ' + name);
}
const functions = ['addNeonToCard','clearNeonFromCard','syncTradeWantNeon','getNeonCardType','applyNeonToCard',
  'isPackCard','handleNeonEntry','setupNeonObservers','cleanupNeonUi','applyNeonAnimationSetting']
  .map(extract).join('\n');
const css = source.match(/globalStyle\.textContent = `([\s\S]*?)`;/)[1];
const card = kind => `<div class="trade__inventory-item ${kind}" style="display:block" role="button" tabindex="0"><img alt="Карта"><div class="card-stats"><span>146</span><span>178</span><span>21</span><span>2</span></div></div>`;
const html = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8')
  : card('user__have__card') + card('user__donthave__card');
(async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  let passed = 0;
  const check = (ok, name) => { if (!ok) throw Error(name); passed++; };
  try {
    for (const width of [1100,390,320]) {
      const page = await browser.newPage();
      await page.route('**/*', route => route.abort());
      await page.setViewportSize({width,height:900});
      await page.setContent('<!doctype html><html><head></head><body><section class="to-inventory-panel"><button id="wantFilter" class="tabs__item tabs__want__card" data-want="1" aria-pressed="false">Хочет</button><div class="trade__inventory" aria-busy="false"><div id="inventory" class="trade__inventory-list"></div></div></section></body></html>');
      await page.evaluate(({html,css}) => {
        const parsed = new DOMParser().parseFromString(html,'text/html');
        for (const [kind,id] of [['user__have__card','owned'],['user__donthave__card','absent']]) {
          const el = parsed.querySelector('.trade__inventory-item.' + kind);
          if (!el) throw Error('Missing fixture card: ' + kind);
          el.querySelectorAll('script,style,link,iframe,object,embed').forEach(n => n.remove());
          for (const node of [el,...el.querySelectorAll('*')]) {
            for (const attr of [...node.attributes]) {
              if (/^on/i.test(attr.name) || /^(src|srcset|href|poster)$/i.test(attr.name)) node.removeAttribute(attr.name);
            }
          }
          el.id = id;
          // Reproduce stale green classes left by 3.69; dimensions use clean baseline.
          el.classList.remove('cv-neon-outline','cv-neon-green','cv-neon-orange');
          document.querySelector('#inventory').append(el);
        }
        const style = document.createElement('style');
        // Representative layout only: attachment contains no site stylesheet.
        style.textContent = `#inventory{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;max-width:420px;padding:10px}
          .trade__inventory-item{box-sizing:border-box;border:2px solid #333;border-radius:12px;min-width:0;overflow:hidden}
          .trade__inventory-item img{display:block;width:100%;aspect-ratio:2/3}
          .card-stats{display:flex;justify-content:space-around;font-size:10px}` + css;
        document.head.append(style);
        window.baseline = [...document.querySelectorAll('.trade__inventory-item')].map(el => ({
          width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,stats:el.querySelector('.card-stats').innerHTML
        }));
        document.querySelector('#absent').classList.add('cv-neon-outline','cv-neon-green');
      }, {html,css});
      await page.addScriptTag({content: `let cfg={modNeon:true,modNeonAnimation:true};
        let neonObserver,neonMutationObserver;let neonObservedSet=new WeakSet(),neonStateMap=new WeakMap(),tradeWantNeonState=new WeakMap();
        ${functions}\nsetupNeonObservers();`});
      await page.waitForFunction(() => document.querySelector('#owned.cv-neon-orange') && !document.querySelector('#absent').classList.contains('cv-neon-outline'));
      check(true,'missing recipient card does not get green; old green removed');
      const fixtureTypes = await page.evaluate(html => {
        const parsed = new DOMParser().parseFromString(html,'text/html');
        return [...parsed.querySelectorAll('.trade__inventory-item')].map(el => ({
          type:getNeonCardType(el),owned:el.classList.contains('user__have__card')
        }));
      }, html);
      check(fixtureTypes.length>0 && fixtureTypes.every(({type,owned}) => type===(owned?'orange':'')), 'all supplied cards: only recipient-owned cards get neon');
      const initial = await page.evaluate(() => [...document.querySelectorAll('.trade__inventory-item')].map((el,i) => ({
        size:Math.abs(el.getBoundingClientRect().width-baseline[i].width)<.1 && Math.abs(el.getBoundingClientRect().height-baseline[i].height)<.1,
        stats:el.querySelector('.card-stats').innerHTML===baseline[i].stats,
        visible:el.style.display==='block',ring:(getComputedStyle(el,'::before').content!== 'none') === (el.id==='owned')
      })));
      for (const result of initial) for (const [key,ok] of Object.entries(result)) check(ok,`${width}: ${key}`);
      check(await page.evaluate(() => document.querySelector('#wantFilter').getAttribute('aria-pressed')==='false'), 'filter stays disabled by default');
      await page.evaluate(() => {
        const button=document.querySelector('#wantFilter');
        button.classList.add('tabs__item__want--active');button.setAttribute('aria-pressed','true');
        const outside=document.createElement('section');outside.className='to-inventory-panel';outside.id='otherPanel';
        outside.innerHTML='<div class="trade__inventory-item user__donthave__card" id="otherCard"></div>';
        document.body.append(outside);
      });
      await page.waitForFunction(() => tradeWantNeonState.get(document.querySelector('.to-inventory-panel'))?.active);
      check(await page.evaluate(() => !document.querySelector('#inventory .cv-neon-green')), 'enabling filter does not color old cards before loading starts');
      await page.evaluate(() => document.querySelector('.trade__inventory').setAttribute('aria-busy','true'));
      await page.waitForFunction(() => tradeWantNeonState.get(document.querySelector('.to-inventory-panel'))?.busy);
      await page.evaluate(() => {
        const list=document.querySelector('#inventory');list.replaceChildren(...[...list.children].map(el=>el.cloneNode(true)));
      });
      await page.waitForFunction(() => tradeWantNeonState.get(document.querySelector('.to-inventory-panel'))?.updated);
      check(await page.evaluate(() => !document.querySelector('#inventory .cv-neon-green')), 'new cards wait while inventory is busy');
      await page.evaluate(() => document.querySelector('.trade__inventory').setAttribute('aria-busy','false'));
      await page.waitForFunction(() => document.querySelector('#owned.cv-neon-green') && document.querySelector('#absent.cv-neon-green'));
      check(true,'green appears after updated list finishes loading');
      check(await page.evaluate(() => !document.querySelector('#otherCard.cv-neon-outline')), 'filter only affects its own inventory panel');
      check(await page.evaluate(() => document.querySelector('#owned.user__have__card') && !document.querySelector('#owned.cv-neon-orange')), 'active want filter overlays orange without altering ownership');
      await page.evaluate(() => {
        const el=document.querySelector('#absent').cloneNode(true);el.id='filteredNew';
        el.classList.remove('cv-neon-outline','cv-neon-green');document.querySelector('#inventory').append(el);
      });
      await page.waitForFunction(() => document.querySelector('#filteredNew.cv-neon-green'));
      check(true,'AJAX cards respect enabled filter');
      // aria-pressed=false wins even before the site removes the active class.
      await page.evaluate(() => document.querySelector('#wantFilter').setAttribute('aria-pressed','false'));
      await page.waitForFunction(() => document.querySelector('#owned.cv-neon-orange') && !document.querySelector('#absent.cv-neon-outline') && !document.querySelector('#filteredNew.cv-neon-outline'));
      check(true,'aria-only disable restores orange and clears plain cards');
      await page.evaluate(() => {
        const button=document.querySelector('#wantFilter');button.removeAttribute('aria-pressed');
      });
      await page.waitForFunction(() => tradeWantNeonState.get(document.querySelector('.to-inventory-panel'))?.active);
      await page.evaluate(() => {
        const list=document.querySelector('#inventory');list.replaceChildren(...[...list.children].map(el=>el.cloneNode(true)));
      });
      await page.waitForFunction(() => document.querySelector('#absent.cv-neon-green'));
      check(true,'legacy class-only active filter');
      await page.evaluate(() => document.querySelector('#wantFilter').classList.remove('tabs__item__want--active'));
      await page.waitForFunction(() => document.querySelector('#owned.cv-neon-orange') && !document.querySelector('#absent.cv-neon-outline'));
      check(true,'class-only disable clears green');
      await page.evaluate(() => {
        const old=document.querySelector('#wantFilter'),next=old.cloneNode(true);
        next.setAttribute('aria-pressed','true');old.replaceWith(next);
      });
      await page.waitForFunction(() => tradeWantNeonState.get(document.querySelector('.to-inventory-panel'))?.active);
      // Failed request: busy ends but the old list is retained.
      await page.evaluate(() => document.querySelector('.trade__inventory').setAttribute('aria-busy','true'));
      await page.waitForFunction(() => tradeWantNeonState.get(document.querySelector('.to-inventory-panel'))?.busy);
      await page.evaluate(() => document.querySelector('.trade__inventory').setAttribute('aria-busy','false'));
      await page.waitForFunction(() => !tradeWantNeonState.get(document.querySelector('.to-inventory-panel'))?.busy);
      check(await page.evaluate(() => !document.querySelector('#inventory .cv-neon-green')), 'failed reload never marks the unchanged old list');
      await page.evaluate(() => {
        const list=document.querySelector('#inventory');list.replaceChildren(...[...list.children].map(el=>el.cloneNode(true)));
      });
      await page.waitForFunction(() => document.querySelector('#absent.cv-neon-green'));
      check(true,'replacement filter refreshes existing cards');
      await page.evaluate(() => {
        document.querySelector('#wantFilter').remove();
        document.querySelector('#filteredNew').remove();document.querySelector('#otherPanel').remove();
      });
      await page.waitForFunction(() => document.querySelector('#owned.cv-neon-orange') && !document.querySelector('#absent.cv-neon-outline'));
      check(true,'removed filter restores native classification');
      await page.evaluate(() => document.querySelector('#owned').classList.replace('user__have__card','user__donthave__card'));
      await page.waitForFunction(() => !document.querySelector('#owned').classList.contains('cv-neon-outline'));
      check(true,'owned to absent removes orange without adding green');
      await page.evaluate(() => document.querySelector('#owned').classList.remove('user__donthave__card'));
      await page.waitForFunction(() => !document.querySelector('#owned').classList.contains('cv-neon-outline'));
      check(true,'stale neon removed; copy count does not imply recipient ownership');
      // Separate synthetic positive case for the already supported explicit wishlist class.
      // Do not mislabel an absent card from the real attachment as a wishlist card.
      await page.evaluate(() => {
        const el=document.querySelector('#absent').cloneNode(true);
        el.id='wanted';el.classList.add('anime-cards__owned-by-user-want');
        document.querySelector('#inventory').append(el);
      });
      await page.waitForFunction(() => document.querySelector('#wanted.cv-neon-green'));
      await page.evaluate(() => {
        const el=document.querySelector('#wanted').cloneNode(true);
        el.id='dynamic';el.classList.remove('cv-neon-outline','cv-neon-green');
        document.querySelector('#inventory').append(el);
      });
      await page.waitForFunction(() => document.querySelector('#dynamic.cv-neon-green'));
      check(true,'new AJAX card observed');
      check(await page.evaluate(() => {
        const el=document.querySelector('#dynamic');
        el.classList.add('user__have__card');
        return getNeonCardType(el)==='green';
      }), 'wanted has precedence over owned');
      check(await page.evaluate(() => {
        const el=document.querySelector('#dynamic');
        const lock=document.createElement('i');lock.className='fal fa-lock';el.append(lock);
        const result=getNeonCardType(el)==='red';lock.remove();return result;
      }), 'existing lock priority retained');
      check(await page.evaluate(() => {
        cfg.modNeonAnimation=false;applyNeonAnimationSetting();
        return getComputedStyle(document.querySelector('#wanted'),'::before').animationName==='none';
      }), 'animation setting respected');
      await page.evaluate(() => {cfg.modNeon=false;cleanupNeonUi();});
      check(await page.evaluate(() => !document.querySelector('.cv-neon-outline') && document.querySelector('#wanted.user__donthave__card').style.display==='block'), 'disable restores site classes and display');
      await page.evaluate(() => {cfg.modNeon=true;setupNeonObservers();});
      await page.waitForFunction(() => document.querySelector('#wanted.cv-neon-green'));
      check(true,'reenable observes existing cards');
      await page.evaluate(() => cleanupNeonUi());
      await page.close();
    }
    console.log(JSON.stringify({result:'TRADE_NEON_OK',passed,fixture:!!process.argv[2]}));
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
