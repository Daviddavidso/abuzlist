/* ==========================================================================
   абузлист — логика каталога
   Ничего править не нужно: весь контент лежит в data.js
   ========================================================================== */
(function () {
  'use strict';

  /* --- короткие помощники ---------------------------------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const rub = (n) => n.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';

  /* «оффер / оффера / офферов» */
  const plural = (n, a, b, c) => {
    const x = n % 10, y = n % 100;
    return (x === 1 && y !== 11) ? a : (x >= 2 && x <= 4 && (y < 10 || y >= 20)) ? b : c;
  };
  const wordOffers = (n) => plural(n, 'оффер', 'оффера', 'офферов');

  const DIFF = {
    easy:   { label: 'Легко',  dots: 1, rank: 1 },
    medium: { label: 'Средне', dots: 2, rank: 2 },
    hard:   { label: 'Сложно', dots: 3, rank: 3 },
  };

  /* ISO-длительность → минуты, для сортировки «сначала быстрые» */
  const minutes = (iso) => {
    const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(iso || '') || [];
    return (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
  };

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
  const srToast    = $('#sr-toast-status');
  const toast      = $('#toast');
  const resetTop   = $('#reset-top');

  const dlg      = $('#offer-dialog');
  const dlgTitle = $('#offer-dialog-title');
  const dlgBrand = $('#dlg-brand');
  const dlgBody  = $('#dlg-body');
  const dlgFoot  = $('#dlg-foot');

  const items = OFFERS.filter((o) => !o.hidden);
  const byId = new Map(items.map((o) => [o.id, o]));
  const catLabel = new Map(CATEGORIES.map((c) => [c.id, c.label]));
  const cards = [];

  /* ======================================================================
     1. Подстановка общих данных сайта
     ====================================================================== */
  function applySite() {
    document.querySelectorAll('#header-tg, #feed-tg, #faq-tg, #footer-tg')
      .forEach((a) => { a.href = SITE.telegram; });
    $('#hero-updated').textContent = SITE.updated;
    $('#hero-updated').dateTime = SITE.updatedISO;
    $('#logo-word').textContent = SITE.name;
    $('#footer-word').textContent = SITE.name;
    $('#year').textContent = String(new Date().getFullYear());

    $('#hero-count').textContent = items.length;
    const sum = items.reduce((s, o) => s + (o.payout || 0), 0);
    $('#hero-sum').textContent = rub(sum);

    $('#feed-list').innerHTML = FEED.map((f) =>
      `<li><b>${esc(f.date)}</b><span>${esc(f.text)}</span></li>`).join('');

    renderTicker();
  }

  /* Бегущая строка брендов под заголовком.
     Список дублируется дважды — за счёт этого прокрутка зацикливается без стыка.
     Блок декоративный: он скрыт от скринридеров через aria-hidden в разметке. */
  function renderTicker() {
    const one = items.map((o) => `
      <span class="ticker__item">
        <span class="ticker__mono" style="background:${esc(o.tile || '#12100f')};color:${esc(o.tileInk || '#fff')}">${esc(o.mono || '')}</span>
        ${esc(o.brand)}
        <span class="ticker__sum">${esc(rub(o.payout))}</span>
      </span>`).join('');
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
        <label class="chip" for="cat-${esc(c.id)}">${esc(c.label)} <span class="chip__count">${n}</span></label>
      </span>`;
    }).join(''));
  }

  /* ======================================================================
     3. Карточки
     ====================================================================== */
  function cardHTML(o) {
    const d = DIFF[o.difficulty] || DIFF.medium;
    const badge = o.badge === 'hot' ? '<p class="card__badge badge--hot">Топ</p>'
                : o.badge === 'new' ? '<p class="card__badge badge--new">Новый</p>' : '';

    const promo = o.promo ? `
      <p class="card__promo">
        Промокод <code translate="no">${esc(o.promo)}</code>
        <button type="button" class="btn-copy" data-copy="${esc(o.promo)}"
                aria-label="Копировать промокод ${esc(o.promo)} для оффера ${esc(o.brand)}">
          <svg class="ico-copy" width="14" height="14" aria-hidden="true" focusable="false"><use href="#i-copy"/></svg>
          <svg class="ico-check" width="14" height="14" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>
          Копировать
        </button>
      </p>` : '';

    return `
      <li class="card" data-id="${esc(o.id)}" data-cat="${esc(o.category)}">
        <div class="card__top">
          <div class="card__monogram" aria-hidden="true"
               style="background:${esc(o.tile || '#12100f')};color:${esc(o.tileInk || '#ffffff')}">${esc(o.mono || '')}</div>
          <div>
            <p class="card__brand">${esc(o.brand)}</p>
            <h3 class="card__title">${esc(o.title)}</h3>
          </div>
          ${badge}
        </div>

        <dl class="card__meta">
          <dt>Выплата</dt>
          <dd><span class="payout">${esc(rub(o.payout))}${o.payoutNote ? `<span class="payout__note">${esc(o.payoutNote)}</span>` : ''}</span></dd>
          <dt>Сложность</dt>
          <dd><span class="diff">${d.label}</span></dd>
          <dt>Время</dt>
          <dd><time class="card__time" datetime="${esc(o.timeISO)}">${esc(o.timeLabel)}</time></dd>
        </dl>

        ${promo}

        <div class="card__actions">
          <button class="btn btn--ghost" type="button" data-detail="${esc(o.id)}" aria-haspopup="dialog">
            Подробнее<span class="vh"> об условиях оффера ${esc(o.brand)}</span>
          </button>
          <a class="btn btn--primary" href="${esc(o.url)}" target="_blank" rel="noopener sponsored">
            Забрать<span class="vh"> бонус в ${esc(o.brand)}, откроется в новой вкладке</span>
            <svg class="icon-ext" width="13" height="13" aria-hidden="true" focusable="false"><use href="#i-ext"/></svg>
          </a>
        </div>

        <p class="card__foot">${esc(o.payoutTerm || '')}</p>
      </li>`;
  }

  function renderCards() {
    grid.innerHTML = items.map(cardHTML).join('');
    grid.querySelectorAll('.card').forEach((el) => {
      const o = byId.get(el.dataset.id);
      el._haystack = [o.brand, o.title, catLabel.get(o.category), o.promo, o.short]
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
        case 'payout-asc':  return x.payout - y.payout;
        case 'difficulty':  return (DIFF[x.difficulty].rank - DIFF[y.difficulty].rank) || (y.payout - x.payout);
        case 'time':        return (minutes(x.timeISO) - minutes(y.timeISO)) || (y.payout - x.payout);
        case 'new':         return items.indexOf(x) - items.indexOf(y);
        default:            return y.payout - x.payout;
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

  function announce(msg, delay) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (msg === lastAnnounced) return;
      lastAnnounced = msg;
      srStatus.textContent = msg;
    }, delay);
  }

  function render(opts) {
    const o = opts || {};
    const count = applyFilters(o.trigger !== 'search');
    const filtered = currentCat() !== 'all' || q.value.trim() !== '';

    countEl.textContent = count === 0
      ? 'Ничего не найдено'
      : `Показано ${count} ${wordOffers(count)} из ${items.length}`;

    grid.hidden = count === 0;
    emptyEl.hidden = count !== 0;
    clearBtn.hidden = q.value === '';
    resetTop.hidden = !filtered;

    syncURL();

    const sortText = sortEl.options[sortEl.selectedIndex].text;
    const msg = count === 0
      ? 'Ничего не найдено. Измените запрос или сбросьте фильтры.'
      : `Найдено ${count} ${wordOffers(count)}. Сортировка: ${sortText}.`;

    if (o.silent) { lastAnnounced = msg; return; }
    announce(msg, o.trigger === 'search' ? SEARCH_DEBOUNCE : CONTROL_DEBOUNCE);
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
    if (radio) radio.checked = true;
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
     5. Промокод в буфер обмена
     ====================================================================== */
  let hideTimer = null, lastToast = null, lastToastAt = 0;

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    /* запасной путь для http-хостинга, где Clipboard API недоступен */
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => toast.classList.remove('is-visible'), 4000);

    const now = Date.now();
    if (msg === lastToast && now - lastToastAt < 1000) return;
    lastToast = msg; lastToastAt = now;
    srToast.textContent = '';
    setTimeout(() => { srToast.textContent = msg; }, 60);
  }

  /* ======================================================================
     6. Модальное окно оффера
     ====================================================================== */
  let lastTrigger = null;

  function openOffer(id, trigger) {
    const o = byId.get(id);
    if (!o || dlg.open) return;
    const d = DIFF[o.difficulty] || DIFF.medium;

    lastTrigger = trigger;
    dlgBrand.textContent = o.brand;
    dlgTitle.textContent = o.title;

    dlgBody.innerHTML = `
      <p class="dlg__lead">${esc(o.short)}</p>

      <dl class="dlg__facts">
        <dt>Выплата</dt>
        <dd><span class="payout">${esc(rub(o.payout))}</span></dd>
        <dt>Сложность</dt>
        <dd><span class="diff">${d.label}</span></dd>
        <dt>Время</dt>
        <dd><time class="card__time" datetime="${esc(o.timeISO)}">${esc(o.timeLabel)}</time></dd>
      </dl>

      <h3>Как получить</h3>
      <ol>${(o.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>

      <h3>Условия</h3>
      <ul class="terms">${(o.terms || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>

      ${o.payoutTerm ? `<p class="dlg__term">${esc(o.payoutTerm)}</p>` : ''}
    `;

    dlgFoot.innerHTML = `
      ${o.promo ? `<button type="button" class="btn btn--ghost btn-copy" data-copy="${esc(o.promo)}"
            aria-label="Копировать промокод ${esc(o.promo)} для оффера ${esc(o.brand)}">
        <svg class="ico-copy" width="15" height="15" aria-hidden="true" focusable="false"><use href="#i-copy"/></svg>
        <svg class="ico-check" width="15" height="15" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>
        Промокод ${esc(o.promo)}
      </button>` : ''}
      <a class="btn btn--primary" href="${esc(o.url)}" target="_blank" rel="noopener sponsored">
        Забрать<span class="vh"> бонус в ${esc(o.brand)}, откроется в новой вкладке</span>
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
     7. События
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

    /* делегирование: карточки перерисовываются только один раз, но так надёжнее */
    document.addEventListener('click', (e) => {
      const detail = e.target.closest('[data-detail]');
      if (detail) { openOffer(detail.dataset.detail, detail); return; }

      const copy = e.target.closest('[data-copy]');
      if (copy) {
        const code = copy.dataset.copy;
        copyText(code).then(() => {
          copy.classList.add('is-done');
          setTimeout(() => copy.classList.remove('is-done'), 2000);
          showToast('Скопировано: ' + code);
        }).catch(() => showToast('Не удалось скопировать. Код: ' + code));
        return;
      }

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
     8. Старт
     ====================================================================== */
  applySite();
  renderChips();
  renderCards();
  readURL();
  sortCards();
  bind();
  render({ silent: true });
})();
