/* ==========================================================================
   Marli Cabeleireira - Pouso Alegre/MG
   Interacoes da landing page
   ==========================================================================
   Para alterar o numero ou a mensagem do WhatsApp, edite apenas o bloco
   CONFIG abaixo. Todos os botoes da pagina sao montados a partir dele.
   -------------------------------------------------------------------------- */

(function () {
  'use strict';

  /* ---------------------------------------------------------------- CONFIG */
  var CONFIG = {
    // Numero no formato internacional, apenas digitos: 55 + DDD + numero
    whatsapp: '5535998323042',

    // Mensagem padrao (botoes gerais, botao flutuante, rodape)
    mensagem: 'Olá, Marli! Gostaria de agendar um horário. Poderia me informar os horários disponíveis?',

    // Mensagem dos botoes dos cards de servico. {servico} e substituido
    // pelo nome do servico do card.
    mensagemServico: 'Olá, Marli! Gostaria de agendar um horário para {servico}. Poderia me informar os horários disponíveis?'
  };

  /* ------------------------------------------------------------- utilidades */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function linkWhatsApp(texto) {
    return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(texto);
  }

  var reduzirMovimento = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  /* ------------------------------------------------- 1. Links do WhatsApp */
  $$('[data-wa]').forEach(function (el) {
    var servico = el.getAttribute('data-servico');
    var texto = servico
      ? CONFIG.mensagemServico.replace('{servico}', servico)
      : CONFIG.mensagem;

    el.setAttribute('href', linkWhatsApp(texto));
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener');
  });

  /* ------------------------------------------------------- 2. Menu mobile */
  var header = $('.site-header');
  var toggle = $('#navToggle');
  var panel = $('#navPanel');

  function fecharMenu() {
    if (!toggle || !panel) return;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu de navegação');
    panel.classList.remove('is-open');
  }

  function abrirMenu() {
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Fechar menu de navegação');
    panel.classList.add('is-open');
  }

  if (toggle && panel) {
    toggle.addEventListener('click', function () {
      var aberto = toggle.getAttribute('aria-expanded') === 'true';
      if (aberto) { fecharMenu(); } else { abrirMenu(); }
    });

    $$('a', panel).forEach(function (a) {
      a.addEventListener('click', fecharMenu);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fecharMenu();
    });

    document.addEventListener('click', function (e) {
      if (panel.classList.contains('is-open') &&
          !panel.contains(e.target) && !toggle.contains(e.target)) {
        fecharMenu();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) fecharMenu();
    });
  }

  /* ------------------------------- 3. Cabecalho + botao flutuante no scroll */
  var waFloat = $('#waFloat');

  function aoRolar() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (header) header.classList.toggle('is-scrolled', y > 12);
    if (waFloat) waFloat.classList.toggle('is-visible', y > 420);
  }

  // Sentinelas invisiveis observadas com IntersectionObserver: funciona mesmo
  // quando o evento 'scroll' nao e disparado (scroll suave, iOS, webviews).
  function sentinela(altura) {
    var el = document.createElement('span');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:' +
      altura + 'px;pointer-events:none;opacity:0';
    document.body.appendChild(el);
    return el;
  }

  if ('IntersectionObserver' in window) {
    if (header) {
      var alvoHeader = sentinela(14);
      new IntersectionObserver(function (e) {
        header.classList.toggle('is-scrolled', !e[0].isIntersecting);
      }).observe(alvoHeader);
    }
    if (waFloat) {
      var alvoFloat = sentinela(420);
      new IntersectionObserver(function (e) {
        waFloat.classList.toggle('is-visible', !e[0].isIntersecting);
      }).observe(alvoFloat);
    }
  }

  // Fallback por evento de scroll (navegadores sem IntersectionObserver)
  var travado = false;
  window.addEventListener('scroll', function () {
    if (travado) return;
    travado = true;
    window.requestAnimationFrame(function () {
      aoRolar();
      travado = false;
    });
  }, { passive: true });

  /* ------------------------------------------- 4. Rolagem suave (fallback) */
  $$('a[href^="#"]').forEach(function (a) {
    var alvoId = a.getAttribute('href');
    if (!alvoId || alvoId === '#') return;

    a.addEventListener('click', function (e) {
      var alvo = document.querySelector(alvoId);
      if (!alvo) return;
      e.preventDefault();
      fecharMenu();
      alvo.scrollIntoView({
        behavior: reduzirMovimento ? 'auto' : 'smooth',
        block: 'start'
      });
      history.replaceState(null, '', alvoId);
    });
  });

  /* ------------------------------------------- 5. Animacoes de entrada */
  var reveals = $$('.reveal');

  if (!('IntersectionObserver' in window) || reduzirMovimento) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    // atraso escalonado para grupos de cards
    $$('[data-stagger]').forEach(function (grupo) {
      $$('.reveal', grupo).forEach(function (el, i) {
        el.style.transitionDelay = Math.min(i, 8) * 70 + 'ms';
      });
    });

    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add('is-in');
        observador.unobserve(entrada.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    reveals.forEach(function (el) { observador.observe(el); });
  }

  /* --------------------------------------- 6. Link ativo na navegacao */
  var secoes = ['inicio', 'sobre', 'servicos', 'localizacao']
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  var navLinks = $$('.nav__link');

  if (secoes.length && navLinks.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        var id = entrada.target.id;
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    secoes.forEach(function (s) { spy.observe(s); });
  }

  /* ------------------------------------------------- 7. Ano no rodape */
  var ano = $('#ano');
  if (ano) ano.textContent = new Date().getFullYear();

})();
