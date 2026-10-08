/* Um Turki UX layer: non-destructive enhancements for the existing static store. */
(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const products = Array.isArray(window.storeProducts) ? window.storeProducts : [];
  const KEY = 'umTurkiRecentlyViewedV1';

  // Feedback is visual only; all cart/favorite writes continue through store-data.js.
  let toastTimer;
  function toast(message) {
    let el = $('.um-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'um-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('um-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('um-show'), 2600);
  }

  document.addEventListener('click', event => {
    const btn = event.target.closest('button');
    if (!btn) return;
    const oldText = btn.textContent.trim();
    if (btn.matches('.product-actions-mini .btn:not(.ask-mini), .product-actions .btn') &&
        /أضف.*السلة/.test(oldText)) {
      toast('تمت إضافة المنتج إلى السلة ✓');
    }
    if (btn.matches('.heart')) {
      toast(btn.classList.contains('active') ? 'تمت الإضافة للمفضلة ♥' : 'تم تحديث المفضلة');
    }
  });

  // Instant, keyboard-friendly product suggestions on the home page.
  const input = $('#homeSearch');
  if (input && products.length) {
    const wrapper = input.closest('.home-search');
    wrapper.style.position = 'relative';
    const list = document.createElement('div');
    list.id = 'um-search-results';
    list.className = 'um-search-dropdown';
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    wrapper.appendChild(list);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', list.id);
    input.setAttribute('aria-expanded', 'false');
    let options = [], active = -1;

    function dismiss() {
      list.hidden = true;
      list.replaceChildren();
      options = [];
      active = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
    function paintActive() {
      options.forEach((el, i) => {
        const on = i === active;
        el.setAttribute('aria-selected', String(on));
        if (on) { input.setAttribute('aria-activedescendant', el.id); el.scrollIntoView({block:'nearest'}); }
      });
      if (active === -1) input.removeAttribute('aria-activedescendant');
    }
    function suggest() {
      const q = input.value.trim();
      if (!q || typeof window.storeSearch !== 'function') { dismiss(); return; }
      const matches = window.storeSearch(q).slice(0, 5);
      list.replaceChildren();
      active = -1;
      options = [];
      matches.forEach(p => {
        const a = document.createElement('a');
        a.href = 'product.html?id=' + encodeURIComponent(p.id);
        a.className = 'um-search-option';
        a.id = 'um-result-' + p.id;
        a.setAttribute('role', 'option');
        a.setAttribute('aria-selected', 'false');
        const img = document.createElement('img');
        img.src = p.image;
        img.alt = '';
        img.loading = 'lazy';
        const text = document.createElement('span');
        const name = document.createElement('strong');
        name.textContent = p.name;
        const sub = document.createElement('small');
        sub.textContent = window.categoryName ? window.categoryName(p.category) : p.category;
        text.append(name, sub);
        a.append(img, text);
        list.appendChild(a);
        options.push(a);
      });
      if (!matches.length) {
        const no = document.createElement('div');
        no.className = 'um-search-option';
        no.textContent = 'لا توجد نتائج مطابقة. جرب كلمة أخرى.';
        list.appendChild(no);
      }
      const all = document.createElement('a');
      all.className = 'um-search-footer';
      all.href = 'categories.html?q=' + encodeURIComponent(q);
      all.textContent = 'عرض جميع نتائج البحث ←';
      list.appendChild(all);
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    input.addEventListener('input', suggest);
    input.addEventListener('focus', suggest);
    input.addEventListener('keydown', event => {
      if (list.hidden) return;
      if (event.key === 'Escape') { dismiss(); event.preventDefault(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!options.length) return;
        event.preventDefault();
        active = (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        paintActive();
      }
      if (event.key === 'Enter' && active !== -1) {
        event.preventDefault();
        event.stopImmediatePropagation();
        location.href = options[active].href;
      }
    }, true);
    document.addEventListener('click', event => {
      if (!wrapper.contains(event.target)) dismiss();
    });
  }

  // Recently viewed suggestions use only local browser storage, not user accounts.
  function recentRead() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(data) ? data.map(Number).filter(Number.isFinite).slice(0, 8) : [];
    } catch { return []; }
  }
  if (location.pathname.endsWith('/product.html')) {
    const id = Number(new URLSearchParams(location.search).get('id'));
    if (products.some(p => p.id === id)) {
      try { localStorage.setItem(KEY, JSON.stringify([id, ...recentRead().filter(x => x !== id)].slice(0, 8))); }
      catch { /* storage may be unavailable */ }
    }
  }
  if (location.pathname.endsWith('/index.html') || location.pathname.endsWith('/public/')) {
    const ids = recentRead();
    const items = ids.map(id => products.find(p => p.id === id)).filter(Boolean).slice(0, 4);
    const sections = document.querySelectorAll('section.home-section');
    if (items.length && sections.length && typeof window.card === 'function') {
      const section = document.createElement('section');
      section.className = 'home-section um-recently';
      const wrap = document.createElement('div');
      wrap.className = 'wrap';
      const header = document.createElement('div');
      header.className = 'sec-head';
      const text = document.createElement('div');
      const heading = document.createElement('h3');
      heading.textContent = 'شاهدتها مؤخرًا';
      const description = document.createElement('p');
      description.textContent = 'ارجع بسرعة إلى المنتجات التي استعرضتها سابقًا.';
      text.append(heading, description);
      header.appendChild(text);
      const grid = document.createElement('div');
      grid.className = 'featured-grid';
      grid.innerHTML = items.map(window.card).join('');
      wrap.append(header, grid);
      section.appendChild(wrap);
      sections[sections.length - 1].before(section);
    }
  }

  // User-controlled sorting without modifying products or interfering with search/filter logic.
  const resultHeader = $('.result-head');
  if (resultHeader && typeof window.storeSearch === 'function' && typeof window.draw === 'function') {
    const nativeSearch = window.storeSearch;
    let sort = 'featured';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'ترتيب المنتجات');
    select.className = 'chip';
    [
      ['featured', 'الترتيب الافتراضي'],
      ['name', 'الاسم: أ إلى ي'],
      ['category', 'حسب القسم']
    ].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    window.storeSearch = (query, category) => {
      const items = nativeSearch(query, category).slice();
      if (sort === 'name') items.sort((a,b) => a.name.localeCompare(b.name,'ar'));
      if (sort === 'category') items.sort((a,b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name,'ar'));
      return items;
    };
    select.addEventListener('change', () => {sort = select.value; window.draw();});
    resultHeader.appendChild(select);
  }

  // Scroll-to-top is only shown when useful.
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'um-backtop';
  back.textContent = '↑';
  back.title = 'العودة إلى أعلى الصفحة';
  back.setAttribute('aria-label', back.title);
  back.addEventListener('click', () => scrollTo({top:0, behavior:'smooth'}));
  document.body.appendChild(back);
  const syncBack = () => back.classList.toggle('is-visible', scrollY > 550);
  addEventListener('scroll', syncBack, {passive:true});
  syncBack();

  document.querySelectorAll('img').forEach(img => {
    if (!img.closest('.hero-visual')) img.loading = 'lazy';
    img.decoding = 'async';
  });
})();