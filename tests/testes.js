// Suite de testes da landing page do Marli Cabeleireira.
// Abre a pagina num navegador de verdade (Chromium, via Playwright) e verifica
// o que nao da para conferir so lendo o codigo: se as imagens carregam, se os
// precos batem entre o card e os dados estruturados, se o menu abre no celular,
// se nao ha rolagem lateral, se a pagina funciona sem JavaScript.
//
// Como rodar:  bash tests/rodar.sh
// Veja tests/README.md para a instalacao.

const { chromium } = require('playwright');
// Endereco testado. Por padrao o servidor local; para testar o site publicado:
//   BASE=https://www.marlicabeleireira.com.br/ node tests/testes.js
const BASE = process.env.BASE || 'http://localhost:8000/';
let pass = 0, fail = 0;
const ok  = (n, c, d='') => { c ? (pass++, console.log('  OK   ' + n)) : (fail++, console.log('  FALHA ' + n + (d ? ' -> ' + d : ''))); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  // ---------- 1. carga, console, requisicoes ----------
  console.log('\n[1] Carga da pagina, console e requisicoes');
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let page = await ctx.newPage();
  const erros = [], falhas = [];
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  page.on('requestfailed', r => falhas.push(r.url()));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const externas = u => /fonts\.googleapis|fonts\.gstatic|google\.com\/maps/.test(u);
  ok('sem erro de JS no console', erros.filter(e => !/fonts|maps|ERR_/.test(e)).length === 0, erros.join(' | '));
  ok('nenhum arquivo local faltando (404)', falhas.filter(u => !externas(u)).length === 0, falhas.filter(u => !externas(u)).join(' | '));
  const nExternas = falhas.filter(externas).length;
  if (nExternas) console.log('       (' + nExternas + ' recurso(s) externo(s) nao carregaram: fontes do Google ou mapa. Sem internet, e esperado.)');

  // ---------- 2. imagens ----------
  console.log('\n[2] Imagens');
  // percorre a pagina para disparar o loading=lazy da galeria antes de medir
  const alturaTotal = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < alturaTotal; y += 700) {
    await page.evaluate(v => window.scrollTo(0, v), y);
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => Array.from(document.images).every(i => i.complete), null, { timeout: 20000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const imgs = await page.$$eval('img', els => els.map(e => ({
    src: e.getAttribute('src'), nat: e.naturalWidth, natH: e.naturalHeight,
    w: e.getAttribute('width'), h: e.getAttribute('height'), alt: e.getAttribute('alt') })));
  ok('todas as ' + imgs.length + ' imagens carregaram', imgs.every(i => i.nat > 0),
     imgs.filter(i => !i.nat).map(i => i.src).join(' | '));
  ok('todas tem alt preenchido', imgs.every(i => i.alt && i.alt.trim()));
  const ar = imgs.filter(i => i.w && i.h && Math.abs((i.w / i.h) - (i.nat / i.natH)) / (i.nat / i.natH) > 0.02);
  ok('width/height declarados batem com o arquivo', ar.length === 0,
     ar.map(i => `${i.src} decl ${i.w}x${i.h} real ${i.nat}x${i.natH}`).join(' | '));

  // ---------- 3. links do WhatsApp ----------
  console.log('\n[3] Links do WhatsApp montados pelo JS');
  const was = await page.$$eval('[data-wa]', els => els.map(e => ({
    href: e.getAttribute('href'), target: e.getAttribute('target'),
    rel: e.getAttribute('rel'), servico: e.getAttribute('data-servico') })));
  ok('28 pontos de conversao', was.length === 28, 'achei ' + was.length);
  ok('todos apontam para wa.me/5535998323042', was.every(w => w.href.startsWith('https://wa.me/5535998323042?text=')));
  ok('todos com target=_blank e rel=noopener', was.every(w => w.target === '_blank' && w.rel === 'noopener'));
  const comServico = was.filter(w => w.servico);
  ok('os ' + comServico.length + ' botoes de card enviam o nome do servico',
     comServico.every(w => decodeURIComponent(w.href.split('?text=')[1]).includes(w.servico)),
     comServico.filter(w => !decodeURIComponent(w.href.split('?text=')[1]).includes(w.servico)).map(w => w.servico).join(' | '));
  ok('mensagem geral pre-preenchida nos outros',
     was.filter(w => !w.servico).every(w => decodeURIComponent(w.href).includes('Gostaria de agendar um horário')));

  // ---------- 4. dados estruturados ----------
  console.log('\n[4] Dados estruturados e coerencia de precos');
  const ld = await page.$$eval('script[type="application/ld+json"]', els => els.map(e => JSON.parse(e.textContent)));
  ok('os 2 blocos JSON-LD sao JSON valido', ld.length === 2);
  ok('HairSalon + FAQPage', ld[0]['@type'] === 'HairSalon' && ld[1]['@type'] === 'FAQPage');
  const offers = {}; ld[0].hasOfferCatalog.itemListElement.forEach(o => offers[o.itemOffered.name] = o.price);
  const cards = await page.$$eval('article.service', els => els.filter(e => e.querySelector('.service__value'))
    .map(e => ({ nome: e.querySelector('.service__name').textContent.trim(),
                 valor: e.querySelector('.service__value').textContent.trim() })));
  const num = s => parseFloat(s.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
  const div = cards.filter(c => offers[c.nome] === undefined || Math.abs(num(c.valor) - parseFloat(offers[c.nome])) > 0.01);
  ok('os 16 cards batem com os Offers do JSON-LD', div.length === 0,
     div.map(c => `${c.nome}: card ${c.valor} vs ld ${offers[c.nome]}`).join(' | '));

  // precos citados em texto livre (FAQ) conferidos contra a tabela
  const tabela = {}; cards.forEach(c => tabela[c.nome.toLowerCase()] = num(c.valor));
  const faqs = await page.$$eval('.faq__item', els => els.map(e => ({
    q: e.querySelector('.faq__pergunta').textContent.trim(),
    a: e.querySelector('.faq__resposta').textContent.trim() })));
  const faqLd = ld[1].mainEntity.map(q => ({ q: q.name, a: q.acceptedAnswer.text }));
  ok(faqs.length + ' perguntas, visivel e JSON-LD com o mesmo texto',
     faqs.length > 0 && faqs.length === faqLd.length &&
     faqs.every((f, i) => f.q === faqLd[i].q && f.a === faqLd[i].a),
     'visivel ' + faqs.length + ' x JSON-LD ' + faqLd.length + ' | ' +
     faqs.map((f, i) => faqLd[i] && f.q === faqLd[i].q && f.a === faqLd[i].a ? '' : 'difere: ' + f.q).filter(Boolean).join(' | '));
  const checa = [['botox', 'botox capilar'], ['mechas', 'mechas'], ['cronograma', 'cronograma capilar'],
                 ['banho de brilho', 'banho de brilho'], ['só cortar', 'só cortar']];
  const confl = [];
  faqs.forEach(f => checa.forEach(([termo, card]) => {
    if (!f.a.toLowerCase().includes(termo)) return;
    const re = new RegExp(termo + '[^.;]*?R\\$\\s*([\\d.]+),00', 'i');
    const m = f.a.toLowerCase().match(re);
    if (m && Math.abs(parseFloat(m[1].replace(/\./g, '')) - tabela[card]) > 0.01)
      confl.push(`"${f.q}" diz R$ ${m[1]} para ${card}, tabela diz R$ ${tabela[card]}`);
  }));
  ok('precos citados nas respostas batem com a tabela', confl.length === 0, confl.join(' | '));

  // ---------- 5. menu mobile ----------
  console.log('\n[5] Menu no celular');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  ok('hamburguer visivel abaixo de 900px', await page.isVisible('#navToggle'));
  ok('nav de desktop escondida', !await page.isVisible('.nav__list'));
  await page.click('#navToggle'); await page.waitForTimeout(450);
  ok('abre e marca aria-expanded=true', await page.getAttribute('#navToggle', 'aria-expanded') === 'true' && await page.isVisible('#navPanel'));
  await page.keyboard.press('Escape'); await page.waitForTimeout(450);
  ok('fecha com Escape', await page.getAttribute('#navToggle', 'aria-expanded') === 'false');
  await page.click('#navToggle'); await page.waitForTimeout(400);
  await page.click('#navPanel a[href="#servicos"]'); await page.waitForTimeout(700);
  ok('fecha ao clicar num item', await page.getAttribute('#navToggle', 'aria-expanded') === 'false');
  await page.click('#navToggle'); await page.waitForTimeout(400);
  await page.mouse.click(10, 500); await page.waitForTimeout(450);
  ok('fecha ao clicar fora', await page.getAttribute('#navToggle', 'aria-expanded') === 'false');
  await page.click('#navToggle'); await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1280, height: 900 }); await page.waitForTimeout(450);
  ok('fecha ao voltar para desktop', await page.getAttribute('#navToggle', 'aria-expanded') === 'false');

  // ---------- 6. scroll: cabecalho e botao flutuante ----------
  console.log('\n[6] Comportamento na rolagem');
  await page.goto(BASE); await page.waitForTimeout(900);
  ok('botao flutuante escondido no topo', !(await page.$eval('#waFloat', e => e.classList.contains('is-visible'))));
  ok('cabecalho sem sombra no topo', !(await page.$eval('.site-header', e => e.classList.contains('is-scrolled'))));
  await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(900);
  ok('botao flutuante aparece depois de rolar', await page.$eval('#waFloat', e => e.classList.contains('is-visible')));
  ok('cabecalho ganha estado is-scrolled', await page.$eval('.site-header', e => e.classList.contains('is-scrolled')));
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(900);
  ok('ambos voltam ao estado inicial',
     !(await page.$eval('#waFloat', e => e.classList.contains('is-visible'))) &&
     !(await page.$eval('.site-header', e => e.classList.contains('is-scrolled'))));

  // ---------- 7. scrollspy ----------
  console.log('\n[7] Link ativo na navegacao (scrollspy)');
  for (const id of ['sobre', 'servicos', 'localizacao']) {
    await page.evaluate(i => document.getElementById(i).scrollIntoView(), id);
    await page.waitForTimeout(800);
    const at = await page.$$eval('.nav__link.is-active', e => e.map(x => x.getAttribute('href')));
    ok('secao ' + id + ' marca o link certo', at.length === 1 && at[0] === '#' + id, at.join(','));
  }

  // ---------- 8. animacoes de entrada ----------
  console.log('\n[8] Animacoes de entrada');
  await page.goto(BASE); await page.waitForTimeout(1200);
  const rv = await page.$$eval('.reveal', e => ({ total: e.length, dentro: e.filter(x => x.classList.contains('is-in')).length }));
  ok('elementos do topo entram (' + rv.dentro + '/' + rv.total + ')', rv.dentro > 0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(2000);
  const rv2 = await page.$$eval('.reveal', e => e.filter(x => !x.classList.contains('is-in')).length);
  ok('todos aparecem ao rolar a pagina inteira', rv2 === 0, rv2 + ' ficaram invisiveis');

  // ---------- 9. sem rolagem lateral ----------
  console.log('\n[9] Rolagem lateral de 280px a 2560px');
  for (const w of [280, 320, 360, 375, 390, 414, 480, 620, 768, 900, 1024, 1280, 1440, 1920, 2560]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(260);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(240);
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(w + 'px sem rolagem lateral', r.sw <= r.cw + 1, `scrollWidth ${r.sw} > ${r.cw}`);
  }

  // ---------- 10. alvos de toque ----------
  console.log('\n[10] Alvos de toque (minimo 44px)');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE); await page.waitForTimeout(900);
  const pequenos = await page.$$eval('a, button, summary', els => els
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 44; })
    .map(e => (e.className.toString() || e.tagName) + ' h=' + Math.round(e.getBoundingClientRect().height)));
  ok('nenhum alvo interativo abaixo de 44px', pequenos.length === 0, pequenos.join(' | '));

  // ---------- 11. acessibilidade basica ----------
  console.log('\n[11] Acessibilidade e semantica');
  await page.setViewportSize({ width: 1280, height: 900 }); await page.goto(BASE); await page.waitForTimeout(600);
  await page.keyboard.press('Tab');
  ok('primeiro Tab chega no "pular para o conteudo"', await page.evaluate(() => document.activeElement.classList.contains('skip-link')));
  const hs = await page.$$eval('h1,h2,h3,h4', e => e.map(x => +x.tagName[1]));
  ok('exatamente um h1', hs.filter(n => n === 1).length === 1);
  let salto = null; for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) salto = hs[i - 1] + '->' + hs[i];
  ok('hierarquia de titulos sem salto', !salto, salto);
  ok('iframe do mapa com title', await page.$eval('.map iframe', e => !!e.getAttribute('title')));
  ok('lang=pt-BR', await page.$eval('html', e => e.getAttribute('lang')) === 'pt-BR');
  const semNome = await page.$$eval('a,button', e => e.filter(x =>
    !x.textContent.trim() && !x.getAttribute('aria-label') && !x.getAttribute('title')).length);
  ok('nenhum link/botao sem nome acessivel', semNome === 0);

  // ---------- 12. FAQ sem JS ----------
  console.log('\n[12] Duvidas frequentes');
  ok('todas as perguntas comecam fechadas', await page.$$eval('.faq__item', e => e.every(x => !x.open)));
  await page.click('.faq__item:first-child .faq__pergunta'); await page.waitForTimeout(400);
  ok('abre ao clicar', await page.$eval('.faq__item:first-child', e => e.open));
  ok('resposta fica visivel', await page.isVisible('.faq__item:first-child .faq__resposta'));

  // ---------- 13. rodape e mapa ----------
  console.log('\n[13] Rodape e mapa');
  ok('ano preenchido pelo JS', /^20\d\d$/.test((await page.textContent('#ano')).trim()));
  ok('fallback do mapa existe para quando o iframe nao carrega', await page.$('.map__fallback') !== null);
  ok('link do Google Maps com o endereco certo',
     (await page.getAttribute('.location__card .btn--primary', 'href')).includes('Pouso+Alegre'));

  // ---------- 14. movimento reduzido ----------
  console.log('\n[14] prefers-reduced-motion');
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE); await p2.waitForTimeout(900);
  ok('todo o conteudo visivel sem depender de animacao',
     await p2.$$eval('.reveal', e => e.every(x => x.classList.contains('is-in'))));
  ok('opacidade final aplicada', await p2.$eval('.hero h1', e => getComputedStyle(e).opacity === '1'));
  await ctx2.close();

  // ---------- 15. sem JavaScript ----------
  console.log('\n[15] Pagina sem JavaScript');
  const ctx3 = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const p3 = await ctx3.newPage();
  await p3.goto(BASE); await p3.waitForTimeout(600);
  ok('titulo e conteudo aparecem', (await p3.textContent('h1')).includes('Sua beleza'));
  ok('texto nao fica invisivel (noscript cobre o reveal)',
     await p3.$eval('.hero h1', e => getComputedStyle(e).opacity === '1'));
  const href0 = await p3.getAttribute('.hero .btn--primary', 'href');
  ok('links do WhatsApp funcionam no HTML, sem JS', href0 && href0.startsWith('https://wa.me/5535998323042'));
  ok('FAQ abre sem JS (details nativo)', await p3.$eval('.faq__item:first-child .faq__pergunta', e => { e.click(); return e.parentElement.open; }));
  await ctx3.close();

  // ---------- 16. abrir a pagina num ponto adiantado ----------
  // Transicao de .85s + atraso escalonado de até .56s: a espera precisa passar de 1,4s.
  console.log('\n[16] Abrir a pagina ja adiantada (link com #, tecla End)');
  for (const [nome, url, tecla] of [
    ['abrir direto em /#localizacao', BASE + '#localizacao', null],
    ['abrir direto em /#agendamento', BASE + '#agendamento', null],
    ['abrir no topo e apertar End', BASE, 'End'],
  ]) {
    const p4 = await ctx.newPage();
    await p4.goto(url, { waitUntil: 'load' });
    await p4.waitForTimeout(1000);
    if (tecla) await p4.keyboard.press(tecla);
    await p4.waitForTimeout(2600);
    const r = await p4.$$eval('.reveal', els => {
      const acima = els.filter(e => e.getBoundingClientRect().bottom < 0);
      return { acima: acima.length, cegos: acima.filter(e => getComputedStyle(e).opacity !== '1').length };
    });
    ok(nome + ': nenhum dos ' + r.acima + ' blocos acima fica invisivel', r.cegos === 0,
       r.cegos + ' em opacity 0');
    await p4.close();
  }

  // ---------- 16b. assinatura do desenvolvedor ----------
  console.log('\n[16b] Assinatura no rodape');
  const pC = await ctx.newPage();
  await pC.goto(BASE); await pC.waitForTimeout(700);
  const cred = await pC.$('.footer__credito a');
  ok('assinatura existe no rodape', cred !== null);
  const hrefC = await pC.getAttribute('.footer__credito a', 'href');
  ok('aponta para o WhatsApp da AXIS, nao o do salao',
     hrefC.startsWith('https://wa.me/5535999755191?text='), hrefC);
  ok('nao usa data-wa (nao e sobrescrito pelo numero do salao)',
     await pC.$eval('.footer__credito a', e => !e.hasAttribute('data-wa')));
  ok('mensagem pre-preenchida', decodeURIComponent(hrefC).includes('gostaria de um site'));
  ok('texto mostra AXIS', (await pC.textContent('.footer__credito')).includes('AXIS'));
  ok('abre em nova aba com rel=noopener',
     await pC.$eval('.footer__credito a', e => e.target === '_blank' && e.rel === 'noopener'));
  await pC.setViewportSize({ width: 390, height: 844 }); await pC.waitForTimeout(300);
  ok('alvo de toque de 44px no celular',
     await pC.$eval('.footer__credito a', e => e.getBoundingClientRect().height >= 44));
  await pC.close();

  // ---------- 17. navegador sem IntersectionObserver ----------
  console.log('\n[17] Navegador antigo, sem IntersectionObserver');
  const ctxIO = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctxIO.addInitScript(() => { delete window.IntersectionObserver; });
  let pIO = await ctxIO.newPage();
  await pIO.goto(BASE); await pIO.waitForTimeout(800);
  ok('IntersectionObserver realmente ausente', await pIO.evaluate(() => !('IntersectionObserver' in window)));
  ok('todo o conteudo visivel (sem animacao de entrada)',
     await pIO.$$eval('.reveal', e => e.every(x => x.classList.contains('is-in'))));
  await pIO.evaluate(() => window.scrollTo(0, 900)); await pIO.waitForTimeout(600);
  ok('botao flutuante aparece pelo fallback de scroll', await pIO.$eval('#waFloat', e => e.classList.contains('is-visible')));
  ok('cabecalho reage pelo fallback de scroll', await pIO.$eval('.site-header', e => e.classList.contains('is-scrolled')));
  await pIO.evaluate(() => window.scrollTo(0, 0)); await pIO.waitForTimeout(600);
  ok('ambos voltam ao estado inicial',
     !(await pIO.$eval('#waFloat', e => e.classList.contains('is-visible'))) &&
     !(await pIO.$eval('.site-header', e => e.classList.contains('is-scrolled'))));
  await pIO.close();
  // abre ja rolada: so passa por causa da chamada inicial de aoRolar()
  pIO = await ctxIO.newPage();
  await pIO.goto(BASE + '#localizacao'); await pIO.waitForTimeout(900);
  ok('abrindo em /#localizacao o cabecalho ja nasce no estado rolado',
     await pIO.$eval('.site-header', e => e.classList.contains('is-scrolled')));
  await pIO.close();
  await ctxIO.close();

  // ---------- 18. ouvintes de scroll ----------
  console.log('\n[18] Ouvintes de scroll registrados');
  const ctxL = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctxL.addInitScript(() => {
    window.__scrollListeners = 0;
    const orig = window.addEventListener.bind(window);
    window.addEventListener = function (t, f, o) { if (t === 'scroll') window.__scrollListeners++; return orig(t, f, o); };
  });
  const pL = await ctxL.newPage();
  await pL.goto(BASE); await pL.waitForTimeout(800);
  const n = await pL.evaluate(() => window.__scrollListeners);
  ok('navegador moderno registra 1 ouvinte de scroll, nao 2', n === 1, 'registrou ' + n);
  await ctxL.close();

  // ---------- 19. medicao de acessos e cliques ----------
  console.log('\n[19] Medicao de acessos e de cliques');

  // (a) desligada por padrao: nada e carregado
  const ctxM = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let pedidosUmami = 0;
  await ctxM.route('**://*.umami.is/**', r => { pedidosUmami++; r.abort(); });
  const pM = await ctxM.newPage();
  await pM.goto(BASE); await pM.waitForTimeout(900);
  ok('com o ID vazio, nenhum script de medicao e carregado', pedidosUmami === 0, pedidosUmami + ' requisicao(oes)');
  ok('nenhuma tag de medicao injetada na pagina',
     await pM.$$eval('script[data-website-id]', e => e.length === 0));
  await pM.click('.hero .btn--primary', { modifiers: [] }).catch(() => {});
  await pM.waitForTimeout(300);
  ok('clicar num botao nao quebra a pagina com a medicao desligada', true);
  await ctxM.close();

  // (b) ligada: simula o ID preenchido e o script do Umami ja carregado
  const ctxL2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctxL2.route('**/assets/js/main.js', async route => {
    const r = await route.fetch();
    const corpo = (await r.text()).replace("umamiId: ''", "umamiId: 'id-de-teste'");
    route.fulfill({ response: r, body: corpo, headers: { ...r.headers(), 'content-type': 'application/javascript' } });
  });
  await ctxL2.route('**://*.umami.is/script.js', route =>
    route.fulfill({ contentType: 'application/javascript',
      body: 'window.umami={track:function(n,d){window.__eventos=window.__eventos||[];window.__eventos.push({nome:n,dados:d});}};' }));
  const pL2 = await ctxL2.newPage();
  await pL2.goto(BASE); await pL2.waitForTimeout(1200);
  ok('com o ID preenchido, a tag e injetada com o ID certo',
     await pL2.$eval('script[data-website-id]', e => e.getAttribute('data-website-id')) === 'id-de-teste');

  const clicar = sel => pL2.$eval(sel, e => { e.removeAttribute('target'); e.setAttribute('href', 'javascript:void 0'); e.click(); });
  await clicar('article.service [data-servico="Mechas"]'); await pL2.waitForTimeout(250);
  await clicar('.hero .btn--primary');                      await pL2.waitForTimeout(250);
  await clicar('.footer__credito a');                       await pL2.waitForTimeout(250);
  const ev = await pL2.evaluate(() => window.__eventos || []);
  ok('clique no card de Mechas registra o servico',
     ev.some(e => e.nome === 'whatsapp' && e.dados && e.dados.servico === 'Mechas'), JSON.stringify(ev));
  ok('clique no botao geral registra como "geral"',
     ev.some(e => e.nome === 'whatsapp' && e.dados && e.dados.servico === 'geral'), JSON.stringify(ev));
  ok('clique na assinatura registra contato-axis',
     ev.some(e => e.nome === 'contato-axis'), JSON.stringify(ev));
  await ctxL2.close();

  await browser.close();
  console.log(`\n${'='.repeat(58)}\n  ${pass} passaram, ${fail} falharam\n${'='.repeat(58)}`);
  process.exit(fail ? 1 : 0);
})();
