/* ==========================================================================
   финвитрина — логика каталога
   Ничего править не нужно: весь контент лежит в data.js
   ========================================================================== */
(function () {
  'use strict';

  /* --- короткие помощники ---------------------------------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* «предложение / предложения / предложений» */
  const plural = (n, a, b, c) => {
    const x = n % 10, y = n % 100;
    return (x === 1 && y !== 11) ? a : (x >= 2 && x <= 4 && (y < 10 || y >= 20)) ? b : c;
  };
  const wordItems = (n) => plural(n, 'предложение', 'предложения', 'предложений');

  /* --- узлы страницы ---------------------------------------------------- */
  const grid       = $('#offer-grid');
  const chipsBox   = $('#chips');
  const sortEl     = $('#sort');
  const q          = $('#q');
  const clearBtn   = $('#search-clear');
  const searchForm = $('#search-form');
  const countEl    = $('#results-count');
  const emptyEl    = $('#empty-state');
  const offersH    = $('#offers-h');
  const srStatus   = $('#sr-filter-status');
  const resetTop   = $('#reset-top');

  const dlg      = $('#offer-dialog');
  const dlgTitle = $('#offer-dialog-title');
  const dlgBrand = $('#dlg-brand');
  const dlgBody  = $('#dlg-body');
  const dlgFoot  = $('#dlg-foot');

  const items = PRODUCTS.filter((o) => !o.hidden);
  const byId = new Map(items.map((o) => [o.id, o]));
  const catLabel = new Map(CATEGORIES.map((c) => [c.id, c.label]));
  const cards = [];

  /* ======================================================================
     1. Подстановка общих данных сайта
     ====================================================================== */
  function applySite() {
    $('#hero-updated').textContent = SITE.updated;
    $('#hero-updated').dateTime = SITE.updatedISO;
    $('#logo-word').textContent = SITE.name;
    $('#footer-word').textContent = SITE.name;
    $('#footer-copy-name').textContent = SITE.name;
    $('#year').textContent = String(new Date().getFullYear());

    const mail = $('#footer-mail');
    mail.textContent = SITE.email;
    mail.href = 'mailto:' + SITE.email;

    $('#hero-count').textContent = items.length;

    $('#feed-list').innerHTML = FEED.map((f) =>
      `<li><b>${esc(f.date)}</b><span>${esc(f.text)}</span></li>`).join('');

    renderTicker();
  }

  /* Бегущая строка с партнёрами. Список дублируется дважды — за счёт этого
     прокрутка зацикливается без стыка. Блок декоративный: скрыт от
     скринридеров через aria-hidden в разметке. */
  function renderTicker() {
    const one = items.map((o) => {
      const first = (o.specs && o.specs[0]) || ['', ''];
      return `
      <span class="ticker__item">
        ${o.logo
          ? `<span class="ticker__logo"><img src="${esc(o.logo)}" alt="" loading="lazy" decoding="async"></span>`
          : `<span class="ticker__mono" style="background:${esc(o.tile || '#12100f')};color:${esc(o.tileInk || '#fff')}">${esc(o.mono || '')}</span>`}
        ${esc(o.brand)}
        <span class="ticker__sum">${esc(first[1])}</span>
      </span>`;
    }).join('');
    $('#ticker').innerHTML = one + one;
  }

  /* ======================================================================
     2. Фильтры-категории
     ====================================================================== */
  function renderChips() {
    chipsBox.insertAdjacentHTML('beforeend', CATEGORIES.map((c) => {
      const n = c.id === 'all' ? items.length : items.filter((o) => o.category === c.id).length;
      if (!n) return '';
      return `<span class="chip-item">
        <input class="chip__input" type="radio" name="category" id="cat-${esc(c.id)}" value="${esc(c.id)}"${c.id === 'all' ? ' checked' : ''}>
        <label class="chip" for="cat-${esc(c.id)}">${esc(c.label)} <span class="chip__count">${n}</span><span class="vh"> ${wordItems(n)}</span></label>
      </span>`;
    }).join(''));
  }

  /* ======================================================================
     3. Карточки
     ====================================================================== */
  function specsHTML(o, cls) {
    return `<dl class="${cls}">
      ${(o.specs || []).map(([label, value]) => `
        <div class="spec">
          <dt>${esc(label)}</dt>
          <dd>${esc(value)}</dd>
        </div>`).join('')}
    </dl>`;
  }

  /* Маркировка рекламы. Идентификатор erid выдаёт партнёрская сеть, и по
     закону о рекламе он показывается рядом с предложением. Если у продукта
     erid нет — блок не выводится. */
  function eridHTML(o) {
    return o.erid
      ? `<p class="erid">Реклама · erid: <span translate="no">${esc(o.erid)}</span></p>`
      : '';
  }

  /* Логотип партнёра. Если картинки нет — показываем монограмму из поля mono,
     так карточка не разваливается. Логотип декоративный: название банка стоит
     текстом рядом, поэтому alt пустой. */
  function brandMark(o) {
    return o.logo
      ? `<span class="card__logo"><img src="${esc(o.logo)}" alt="" loading="lazy" decoding="async"></span>`
      : `<span class="card__monogram" aria-hidden="true"
             style="background:${esc(o.tile || '#12100f')};color:${esc(o.tileInk || '#ffffff')}">${esc(o.mono || '')}</span>`;
  }

  function cardHTML(o) {
    const tag = o.tag ? `<p class="card__badge">${esc(o.tag)}</p>` : '';

    return `
      <li class="card" data-id="${esc(o.id)}" data-cat="${esc(o.category)}">
        <div class="card__top">
          ${brandMark(o)}
          ${tag}
        </div>
        <p class="card__brand">${esc(o.brand)}</p>
        <h3 class="card__title">${esc(o.title)}<span class="vh"> — ${esc(o.brand)}</span></h3>

        ${specsHTML(o, 'card__specs')}

        <div class="card__actions">
          <button class="btn btn--ghost" type="button" data-detail="${esc(o.id)}" aria-haspopup="dialog">
            Подробнее<span class="vh"> об условиях продукта «${esc(o.title)}» ${esc(o.brand)}</span>
          </button>
          <a class="btn btn--primary" href="${esc(o.url)}" target="_blank" rel="noopener sponsored">
            К партнёру<span class="vh"> ${esc(o.brand)}, откроется в новой вкладке</span>
            <svg class="icon-ext" width="13" height="13" aria-hidden="true" focusable="false"><use href="#i-ext"/></svg>
          </a>
        </div>

        <p class="card__foot">${esc(o.note || '')}</p>
        ${eridHTML(o)}
      </li>`;
  }

  function renderCards() {
    grid.innerHTML = items.map(cardHTML).join('');
    grid.querySelectorAll('.card').forEach((el) => {
      const o = byId.get(el.dataset.id);
      el._haystack = [o.brand, o.title, catLabel.get(o.category), o.short]
        .concat((o.specs || []).map((s) => s[1]))
        .filter(Boolean).join(' ').toLowerCase();
      cards.push(el);
    });
  }

  /* ======================================================================
     4. Фильтрация, сортировка, счётчик
     ====================================================================== */
  const SEARCH_DEBOUNCE = 500, CONTROL_DEBOUNCE = 150;
  let timer = null, lastAnnounced = null;

  const currentCat = () => (chipsBox.querySelector('input:checked') || {}).value || 'all';

  /* Перестановка узлов не пересоздаёт их — фокус и состояние живут дальше. */
  function sortCards() {
    const mode = sortEl.value;
    const arr = cards.slice();
    arr.sort((a, b) => {
      const x = byId.get(a.dataset.id), y = byId.get(b.dataset.id);
      switch (mode) {
        /* sortRate: null — «ставка неприменима» (карты). Такие уходят в конец,
           иначе они смешиваются с настоящими 0%. */
        case 'rate': {
          const rx = x.sortRate == null ? Infinity : x.sortRate;
          const ry = y.sortRate == null ? Infinity : y.sortRate;
          return rx - ry;
        }
        case 'sum':  return (y.sortSum || 0) - (x.sortSum || 0);
        case 'term': return (y.sortTerm || 0) - (x.sortTerm || 0);
        default:     return items.indexOf(x) - items.indexOf(y);
      }
    });
    const active = document.activeElement;
    grid.append(...arr);
    if (active && active.isConnected && document.activeElement !== active) {
      active.focus({ preventScroll: true });
    }
  }

  function applyFilters(moveFocusIfLost) {
    const cat = currentCat();
    const term = q.value.trim().toLowerCase();
    const focused = document.activeElement;
    let lost = false, visible = 0;

    for (const card of cards) {
      const o = byId.get(card.dataset.id);
      const show = (cat === 'all' || o.category === cat) &&
                   (!term || card._haystack.includes(term));
      if (!show && card.contains(focused)) lost = true;
      card.hidden = !show;
      if (show) visible++;
    }
    if (lost && moveFocusIfLost) offersH.focus();
    return visible;
  }

  /* key — состояние фильтров, а не текст. Иначе два разных фильтра с одинаковым
     числом предложений дают одинаковую строку, и смена фильтра не объявляется. */
  function announce(msg, delay, key) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (key === lastAnnounced) return;
      lastAnnounced = key;
      srStatus.textContent = msg;
    }, delay);
  }

  function render(opts) {
    const o = opts || {};
    const count = applyFilters(o.trigger !== 'search');
    const filtered = currentCat() !== 'all' || q.value.trim() !== '';

    countEl.textContent = count === 0
      ? 'Ничего не найдено'
      : `Показано ${count} ${wordItems(count)} из ${items.length}`;

    grid.hidden = count === 0;
    emptyEl.hidden = count !== 0;
    clearBtn.hidden = q.value === '';
    resetTop.hidden = !filtered;

    syncURL();

    const sortText = sortEl.options[sortEl.selectedIndex].text;
    /* Название категории в начале — при сбросе фильтров радио переключается
       программно, и без него пользователь не услышит, что категория сменилась. */
    const scope = catLabel.get(currentCat()) || 'Все продукты';
    const msg = count === 0
      ? `${scope}: ничего не найдено. Измените запрос или сбросьте фильтры.`
      : `${scope}: найдено ${count} ${wordItems(count)}. Сортировка: ${sortText}.`;
    const state = [currentCat(), q.value.trim(), sortEl.value, count].join('|');

    if (o.silent) { lastAnnounced = state; return; }
    announce(msg, o.trigger === 'search' ? SEARCH_DEBOUNCE : CONTROL_DEBOUNCE, state);
  }

  /* адрес страницы — чтобы можно было дать ссылку сразу на категорию */
  function syncURL() {
    const p = new URLSearchParams();
    if (currentCat() !== 'all') p.set('cat', currentCat());
    if (q.value.trim()) p.set('q', q.value.trim());
    const qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  function readURL() {
    const p = new URLSearchParams(location.search);
    const cat = p.get('cat');
    const radio = cat && chipsBox.querySelector(`input[value="${CSS.escape(cat)}"]`);
    if (radio) {
      radio.checked = true;
      /* На узком экране лента чипов прокручивается: без этого выбранная
         категория остаётся за правым краем и выглядит как невыбранная. */
      const label = chipsBox.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
      if (label) {
        const shift = label.getBoundingClientRect().left - chipsBox.getBoundingClientRect().left;
        chipsBox.scrollLeft = Math.max(0, chipsBox.scrollLeft + shift - 16);
      }
    }
    if (p.get('q')) q.value = p.get('q');
  }

  function resetAll(focusTarget) {
    const all = chipsBox.querySelector('input[value="all"]');
    if (all) all.checked = true;
    q.value = '';
    if (focusTarget) focusTarget.focus();   /* фокус переносим ДО скрытия кнопок */
    render({ trigger: 'control' });
  }

  /* ======================================================================
     5. Карточка продукта в модальном окне
     ====================================================================== */
  let lastTrigger = null;

  function openOffer(id, trigger) {
    const o = byId.get(id);
    if (!o || dlg.open) return;

    lastTrigger = trigger;
    dlgBrand.textContent = o.brand;
    dlgTitle.textContent = o.title;

    dlgBody.innerHTML = `
      ${o.logo ? `<span class="dlg__logo"><img src="${esc(o.logo)}" alt="" decoding="async"></span>` : ''}
      <p class="dlg__lead">${esc(o.short)}</p>

      ${specsHTML(o, 'dlg__facts')}

      <h3>На что обратить внимание</h3>
      <ul class="terms">${(o.terms || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>

      <h3>Как оформить</h3>
      <ol>${(o.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>

      ${o.note ? `<p class="dlg__term">${esc(o.note)}</p>` : ''}

      <p class="dlg__term">Значения со звёздочкой — ориентиры для сравнения. Окончательные условия
      определяет партнёр и указывает их в договоре.</p>

      ${eridHTML(o)}
    `;

    dlgFoot.innerHTML = `
      <a class="btn btn--primary" href="${esc(o.url)}" target="_blank" rel="noopener sponsored">
        Перейти к партнёру<span class="vh"> ${esc(o.brand)}, откроется в новой вкладке</span>
        <svg class="icon-ext" width="13" height="13" aria-hidden="true" focusable="false"><use href="#i-ext"/></svg>
      </a>`;

    document.documentElement.classList.add('is-modal-open');
    dlg.showModal();
    dlgTitle.focus();
  }

  /* Разблокировка страницы и возврат фокуса.
     Функция идемпотентна: её можно звать сколько угодно раз.
     Вызывается и по событию close, и вручную — часть браузеров
     не доставляет close, и тогда страница осталась бы без скролла. */
  function afterClose() {
    if (dlg.open) return;
    document.documentElement.classList.remove('is-modal-open');
    const t = (lastTrigger && lastTrigger.isConnected) ? lastTrigger : null;
    lastTrigger = null;
    if (t && document.activeElement !== t) t.focus();
  }

  dlg.addEventListener('close', afterClose);
  dlg.addEventListener('cancel', () => setTimeout(afterClose, 0));

  function closeOffer() { dlg.close(); afterClose(); }

  /* ======================================================================
     6. События
     ====================================================================== */
  function bind() {
    chipsBox.addEventListener('change', () => render({ trigger: 'control' }));
    sortEl.addEventListener('change', () => { sortCards(); render({ trigger: 'control' }); });

    q.addEventListener('input', () => render({ trigger: 'search' }));
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && q.value !== '') { e.preventDefault(); clearBtn.click(); }
    });
    searchForm.addEventListener('submit', (e) => { e.preventDefault(); render({ trigger: 'control' }); offersH.focus(); });
    clearBtn.addEventListener('click', () => { q.value = ''; q.focus(); render({ trigger: 'control' }); });

    $('#reset-filters').addEventListener('click', () => resetAll(offersH));
    resetTop.addEventListener('click', () => resetAll(offersH));

    document.addEventListener('click', (e) => {
      const detail = e.target.closest('[data-detail]');
      if (detail) { openOffer(detail.dataset.detail, detail); return; }
      if (e.target.closest('[data-dialog-close]')) closeOffer();
    });

    /* высота шапки — для корректного скролла к якорям */
    const header = $('.site-header');
    const sync = () => document.documentElement.style
      .setProperty('--header-h', header.offsetHeight + 'px');
    if ('ResizeObserver' in window) new ResizeObserver(sync).observe(header);
    sync();

    /* активный пункт меню */
    const links = Array.from(document.querySelectorAll('.nav a'));
    if ('IntersectionObserver' in window && links.length) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          const link = links.find((l) => l.getAttribute('href') === '#' + en.target.id);
          if (!link) return;
          if (en.isIntersecting) {
            links.forEach((l) => l.removeAttribute('aria-current'));
            link.setAttribute('aria-current', 'location');
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      ['offers', 'how', 'faq'].forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    }
  }

  /* ======================================================================
     7. Старт
     ====================================================================== */
  applySite();
  renderChips();
  renderCards();
  readURL();
  sortCards();
  bind();
  render({ silent: true });
})();
