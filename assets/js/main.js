(function () {
  'use strict';

  /* CONFIG */
  var CONFIG = {
    // Numero no formato internacional
    whatsapp: '5535998323042',

    // Mensagem padrao (botoes gerais, botao flutuante, rodape)
    mensagem: 'Olá, Marli! Gostaria de agendar um horário. Poderia me informar os horários disponíveis?',

    // Mensagem dos botoes dos cards de servico.
    // pelo nome do servico do card.
    mensagemServico: 'Olá, Marli! Gostaria de agendar um horário para {servico}. Poderia me informar os horários disponíveis?',

    // Medicao de acessos (Umami). So o ID do site, no formato do exemplo
    // abaixo - nao a tag <script> inteira. Ele aparece no painel do Umami em
    // Settings > Websites > Edit. Com o ID vazio, nada e carregado.
    umamiId: '68cde42c-46a3-41db-87fa-26bb4c195d6d',
    umamiScript: 'https://cloud.umami.is/script.js',

    // So conta acessos vindos destes enderecos: os testes e as visualizacoes
    // no proprio computador (localhost) ficam fora da contagem.
    umamiDominios: 'www.marlicabeleireira.com.br,marlicabeleireira.com.br'
  };

  /*  utilidades */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function linkWhatsApp(texto) {
    return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(texto);
  }

  var reduzirMovimento = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  /* 1. Links do WhatsApp */
  $$('[data-wa]').forEach(function (el) {
    var servico = el.getAttribute('data-servico');
    var texto = servico
      ? CONFIG.mensagemServico.replace('{servico}', servico)
      : CONFIG.mensagem;

    el.setAttribute('href', linkWhatsApp(texto));
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener');
  });

  /* 2. Menu mobile */
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

  /* 3. Cabecalho + botao flutuante no scroll */
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
  } else {
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

    aoRolar();   // estado inicial, caso a pagina abra ja rolada
  }

  /* 4. Rolagem suave (fallback) */
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

  /* 5. Animacoes de entrada */
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

    function revelar(el) {
      el.classList.add('is-in');
      observador.unobserve(el);
    }

    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        // Tambem revela o que a pagina abriu ja tendo passado: com um link "#"
        // na URL ou com o navegador restaurando a rolagem, o elemento nunca
        // cruza a tela e ficaria invisivel para sempre.
        if (entrada.isIntersecting || entrada.boundingClientRect.bottom < 0) {
          revelar(entrada.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    reveals.forEach(function (el) { observador.observe(el); });

    // Num salto instantaneo (tecla End, Ctrl+F, clique na barra de rolagem) o
    // elemento pula de "abaixo da tela" para "acima da tela" sem nunca estar
    // visivel: o observador nao dispara, e so esta varredura o recupera.
    var varrendo = false;
    window.addEventListener('scroll', function () {
      if (varrendo || !reveals.length) return;
      varrendo = true;
      window.requestAnimationFrame(function () {
        reveals = reveals.filter(function (el) {
          if (el.classList.contains('is-in')) return false;
          if (el.getBoundingClientRect().bottom >= 0) return true;
          revelar(el);
          return false;
        });
        varrendo = false;
      });
    }, { passive: true });
  }

  /* 6. Link ativo na navegacao */
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

  /* 7. Ano no rodape */
  var ano = $('#ano');
  if (ano) ano.textContent = new Date().getFullYear();

  /* 8. Medicao de acessos e de cliques */
  // O Umami nao usa cookies e nao identifica a pessoa: conta a visita e o
  // clique, nada mais. Por isso a pagina nao precisa de aviso de cookies.
  if (CONFIG.umamiId) {
    var medidor = document.createElement('script');
    medidor.defer = true;
    medidor.src = CONFIG.umamiScript;
    medidor.setAttribute('data-website-id', CONFIG.umamiId);
    if (CONFIG.umamiDominios) medidor.setAttribute('data-domains', CONFIG.umamiDominios);
    document.head.appendChild(medidor);
  }

  // Registra um evento. Se a medicao estiver desligada ou o script ainda nao
  // tiver carregado, nao faz nada - nunca quebra a pagina nem atrapalha o clique.
  function registrar(evento, dados) {
    try {
      if (window.umami && typeof window.umami.track === 'function') {
        window.umami.track(evento, dados);
      }
    } catch (e) { /* medicao nunca pode atrapalhar o site */ }
  }

  // Cada botao de WhatsApp ja sabe de qual servico e, pelo data-servico:
  // da para ver qual servico mais gera contato.
  $$('[data-wa]').forEach(function (el) {
    el.addEventListener('click', function () {
      registrar('whatsapp', { servico: el.getAttribute('data-servico') || 'geral' });
    });
  });

  // Botao que abre o endereco no Google Maps
  var verLocal = $('.location__card .btn--primary');
  if (verLocal) {
    verLocal.addEventListener('click', function () { registrar('ver-localizacao'); });
  }

  // Assinatura no rodape: quem procura quem fez o site
  var credito = $('.footer__credito a');
  if (credito) {
    credito.addEventListener('click', function () { registrar('contato-axis'); });
  }

})();
