/* Um Turki Studio — real catalog discovery, modal quick-view, comparison.
   No third-party tracking, no invented prices, no server-side data changes. */
(function () {
  'use strict';
  const products = Array.isArray(window.storeProducts) ? window.storeProducts : [];
  if (!products.length) return;
  const categories = window.storeCategories || {};
  const byId = id => products.find(p => p.id === Number(id));
  const $ = selector => document.querySelector(selector);
  const escapeText = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const storeKey = 'umTurkiCompareV1';
  let memoryCompare = [];
  const readCompared = () => {
    let ids;
    try {
      const value = JSON.parse(localStorage.getItem(storeKey) || '[]');
      ids = Array.isArray(value) ? value : [];
    } catch { ids = memoryCompare; }
    return [...new Set(ids.map(Number).filter(n => Number.isInteger(n) && byId(n)))].slice(0, 3);
  };
  const persistCompared = ids => {
    memoryCompare = ids;
    try { localStorage.setItem(storeKey, JSON.stringify(ids)); }
    catch { /* private browsing: keep selection for this session */ }
    syncCompareUI();
  };
  function message(text) {
    let el = $('.um-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'um-toast';
      el.setAttribute('role','status');
      el.setAttribute('aria-live','polite');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('um-show');
    clearTimeout(message.timer);
    message.timer = setTimeout(() => el.classList.remove('um-show'), 2700);
  }
  function toggleCompared(id) {
    const ids = readCompared();
    const number = Number(id);
    if (!byId(number)) return false;
    const existing = ids.indexOf(number);
    if (existing !== -1) {
      ids.splice(existing, 1);
      persistCompared(ids);
      message('تمت إزالة المنتج من المقارنة');
      return false;
    }
    if (ids.length >= 3) {
      message('يمكنك مقارنة ثلاثة منتجات كحد أقصى؛ احذف منتجًا أولًا');
      return false;
    }
    ids.push(number);
    persistCompared(ids);
    message('تمت إضافة المنتج للمقارنة ✓');
    return true;
  }

  let dock;
  function ensureDock() {
    if (location.pathname.endsWith('/compare.html')) return null;
    if (dock) return dock;
    dock = document.createElement('aside');
    dock.className = 'studio-dock';
    dock.setAttribute('aria-label', 'مقارنة المنتجات');
    dock.hidden = true;
    dock.innerHTML = '<b class="studio-dock-count"></b><a class="btn" href="compare.html">⚖ عرض المقارنة ←</a><button class="studio-clear" type="button" title="مسح المقارنة" aria-label="مسح المقارنة">×</button>';
    dock.querySelector('.studio-clear').addEventListener('click', () => {
      persistCompared([]);
      message('تم مسح قائمة المقارنة');
    });
    document.body.appendChild(dock);
    return dock;
  }
  function syncCompareUI() {
    const ids = readCompared();
    const bar = ensureDock();
    if (bar) {
      bar.hidden = ids.length === 0;
      bar.querySelector('.studio-dock-count').textContent = '⚖ ' + ids.length + ' من ٣ منتجات';
    }
    document.querySelectorAll('[data-compare-product]').forEach(btn => {
      const selected = ids.includes(Number(btn.dataset.compareProduct));
      btn.setAttribute('aria-pressed', String(selected));
      if (btn.classList.contains('studio-card-compare')) btn.textContent = selected ? '✓ تمت الإضافة للمقارنة' : '⚖ أضف للمقارنة';
      if (btn.classList.contains('lab-add-compare')) btn.textContent = selected ? '✓ تمت الإضافة' : '+ قارن';
    });
    if ($('#compare-content')) renderComparison();
  }

  // Native <dialog> supports Escape, keyboard focus and semantic modal behavior.
  let modal;
  function quickView(id) {
    const p = byId(id);
    if (!p) return;
    if (!('HTMLDialogElement' in window)) { location.href = 'product.html?id=' + p.id; return; }
    if (!modal) {
      modal = document.createElement('dialog');
      modal.className = 'studio-modal';
      modal.setAttribute('aria-label', 'معاينة سريعة للمنتج');
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
    }
    const cat = categories[p.category] || {name:p.category,icon:'✦'};
    const selected = readCompared().includes(p.id);
    const highlights = Array.isArray(p.highlights) && p.highlights.length ?
      '<div class="lab-product-tags">' + p.highlights.slice(0,3).map(t =>
        '<span>' + escapeText(t) + '</span>').join('') + '</div>' : '';
    modal.innerHTML = '<button class="studio-close" aria-label="إغلاق المعاينة" type="button">×</button>' +
      '<div class="studio-modal-grid"><div class="studio-modal-media"><img src="' + escapeText(p.image) +
      '" alt="' + escapeText(p.name) + '"></div><div class="studio-modal-content">' +
      '<span class="studio-modal-label">' + escapeText(cat.icon + ' ' + cat.name) + ' • اكتشف التفاصيل</span>' +
      '<h2>' + escapeText(p.name) + '</h2><p>' + escapeText(p.short || p.desc) + '</p>' +
      highlights + '<div class="price-contact" style="margin-top:17px">تواصل معنا لمعرفة السعر والتوفر</div>' +
      '<div class="studio-modal-actions"><button class="btn" data-action="add-cart">+ أضف للسلة</button>' +
      '<button class="btn alt" data-action="compare" data-compare-product="' + p.id + '" aria-pressed="' +
      selected + '">' + (selected ? '✓ في المقارنة' : '⚖ قارن') + '</button>' +
      '<a class="btn outline" href="product.html?id=' + p.id + '">التفاصيل الكاملة ←</a>' +
      '<button class="btn outline" data-action="whatsapp">استفسر عبر واتساب</button></div></div></div>';
    modal.querySelector('.studio-close').addEventListener('click', () => modal.close());
    modal.querySelector('[data-action="add-cart"]').addEventListener('click', () => {
      window.addToCart(p.id);
      window.updateBadges();
      message('أضفنا ' + p.name + ' إلى السلة ✓');
    });
    modal.querySelector('[data-action="compare"]').addEventListener('click', () => {
      toggleCompared(p.id);
      const selectedNow = readCompared().includes(p.id);
      const btn = modal.querySelector('[data-action="compare"]');
      btn.textContent = selectedNow ? '✓ في المقارنة' : '⚖ قارن';
      btn.setAttribute('aria-pressed', String(selectedNow));
    });
    modal.querySelector('[data-action="whatsapp"]').addEventListener('click', () => window.productWhatsApp(p.id));
    modal.showModal();
  }

  // Upgrade existing cards without replacing cart or favorite behavior.
  function decorateCards() {
    document.querySelectorAll('.product').forEach(card => {
      if (card.dataset.studioEnhanced) return;
      const anchor = card.querySelector('a[href*="product.html?id="]');
      if (!anchor) return;
      const match = anchor.getAttribute('href').match(/[?&]id=(\d+)/);
      if (!match || !byId(match[1])) return;
      const id = Number(match[1]);
      const media = card.querySelector('.product-img');
      const body = card.querySelector('.product-body');
      if (!media || !body) return;
      card.dataset.studioEnhanced = 'true';
      const view = document.createElement('button');
      view.type = 'button';
      view.className = 'studio-card-quick';
      view.textContent = '◉ نظرة سريعة';
      view.setAttribute('aria-label', 'معاينة سريعة: ' + byId(id).name);
      view.addEventListener('click', () => quickView(id));
      media.appendChild(view);
      const compare = document.createElement('button');
      compare.type = 'button';
      compare.className = 'studio-card-compare';
      compare.dataset.compareProduct = String(id);
      compare.setAttribute('aria-label','إضافة للمقارنة: ' + byId(id).name);
      compare.addEventListener('click', () => toggleCompared(id));
      body.appendChild(compare);
    });
  }
  const containers = ['#featured','#grid','#related'];
  containers.forEach(selector => {
    const root = $(selector);
    if (!root) return;
    const observer = new MutationObserver(decorateCards);
    observer.observe(root,{childList:true,subtree:true});
  });
  decorateCards();

  // Hero-sized editorial entry point directly inside the existing homepage.
  if ($('.trust') && $('.hero-card') && !$('.studio-entry')) {
    const host = document.createElement('section');
    host.className = 'studio-entry';
    host.setAttribute('aria-label','مساعد اختيار المنتجات');
    const picture = products.find(p => p.slug === 'afiura-soap-collection') || products[0];
    host.innerHTML =
      '<div class="studio-entry-copy"><span class="lab-overline">THE DISCOVERY EDITION</span>' +
      '<h2>تجربة اختيار مصممة لك.<br>مش مجرد قائمة منتجات.</h2>' +
      '<p>اكتشف الخيارات حسب اهتمامك، قارنها مباشرة، واطلب بسهولة عبر واتساب.</p>' +
      '<a href="discover.html">ابدأ استوديو الاكتشاف ←</a> &nbsp; <a href="compare.html" style="background:transparent;border:1px solid rgba(255,255,255,.35);color:white">قارن المنتجات ⚖</a></div>' +
      '<div class="studio-entry-img"><img src="' + escapeText(picture.image) + '" alt="' +
      escapeText(picture.name) + '" loading="lazy"><span class="studio-metric">✦ ' +
      products.length + ' منتجًا ضمن الكتالوج</span></div>';
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.appendChild(host);
    const sections = document.querySelectorAll('section.home-section');
    if (sections.length) sections[0].before(wrap);
  }

  // On the product details page also expose comparison near the existing actions.
  const detailRoot = $('#detail');
  function addDetailCompare() {
    if (!detailRoot) return;
    const card = detailRoot.querySelector('.detail-card');
    const id = Number(new URLSearchParams(location.search).get('id'));
    if (!card || !byId(id) || card.querySelector('.studio-detail-compare')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn outline full studio-detail-compare';
    btn.dataset.compareProduct = String(id);
    btn.style.marginTop = '11px';
    btn.textContent = '⚖ أضف المنتج إلى المقارنة';
    btn.addEventListener('click', () => {
      toggleCompared(id);
      btn.textContent = readCompared().includes(id) ? '✓ في المقارنة' : '⚖ أضف المنتج إلى المقارنة';
    });
    card.appendChild(btn);
    btn.textContent = readCompared().includes(id) ? '✓ في المقارنة' : '⚖ أضف المنتج إلى المقارنة';
  }
  if (detailRoot) {
    addDetailCompare();
    new MutationObserver(addDetailCompare).observe(detailRoot,{childList:true});
  }

  // Guided product discovery is strictly based on the descriptions in the catalog.
  const categoryGoals = {
    skin:[
      {label:'ترطيب ونعومة',icon:'💧',words:['ترطيب','نعومة','كريم']},
      {label:'تنظيف يومي',icon:'🌿',words:['تنظيف','صابونة','صابون','نظافة']},
      {label:'مظهر ولون البشرة',icon:'🌸',words:['ورد','توريد','عكر','بودرة','النيلة']}
    ],
    hair:[
      {label:'روتين الشعر',icon:'🌱',words:['زيت','شعر','نعومة']},
      {label:'العناية بالفروة',icon:'✨',words:['فروة','شامبو','بخاخ']},
      {label:'الأعشاب الطبيعية',icon:'🍃',words:['أعشاب','عشبة','مشاط']}
    ],
    eyes:[
      {label:'الرموش والحواجب',icon:'✨',words:['رموش','حواجب','رموشي']},
      {label:'العناية بمحيط العين',icon:'👁️',words:['هالات','محيط العين','تحت العين']},
      {label:'اكتشاف جميع الخيارات',icon:'✦',words:[]}
    ],
    personal:[
      {label:'الانتعاش اليومي',icon:'☀️',words:['انتعاش','نظافة','بخاخ']},
      {label:'روتين الأسنان',icon:'🦷',words:['أسنان','كربونكس','فم']},
      {label:'تصفح المنتجات',icon:'✦',words:[]}
    ],
    wellness:[
      {label:'خلطات غذائية',icon:'🥜',words:['عسل','مكسرات','تغذية']},
      {label:'القهوة والمشروبات',icon:'☕',words:['قهوة','مشروب','قهوة الرشاقة']},
      {label:'اكتشاف جميع الخيارات',icon:'✦',words:[]}
    ]
  };
  const stage = $('#lab-stage');
  let labStep = 0, chosenCategory = null, chosenGoal = null, chosenSet = null;
  function buttonOption(label,description,icon,value) {
    return '<button type="button" class="lab-opt" data-value="' + escapeText(value) +
      '"><span class="lab-opt-icon">' + escapeText(icon) + '</span><b>' + escapeText(label) +
      '</b><small>' + escapeText(description) + '</small></button>';
  }
  function stageActions(back) {
    return '<div class="lab-step-actions"><button class="btn lab-prev" data-lab-action="back">← رجوع</button>' +
      '<a class="lab-link" href="categories.html">أو تصفح جميع المنتجات ↗</a></div>';
  }
  function scoreProduct(p, words) {
    const hay = [p.name,p.short,p.desc].concat(p.highlights || []).join(' ').toLowerCase();
    let n = p.featured ? 0.25 : 0;
    words.forEach(w => {if (hay.includes(w.toLowerCase())) n += 3;});
    return n;
  }
  function labCard(p,i) {
    const cat = categories[p.category] || {name:p.category};
    const selected = readCompared().includes(p.id);
    const tags = (p.highlights || []).slice(0,2).map(t =>
      '<span>' + escapeText(t) + '</span>').join('');
    return '<article class="lab-product">' +
      '<a class="lab-product-pic" href="product.html?id=' + p.id + '">' +
      '<img src="' + escapeText(p.image) + '" alt="' + escapeText(p.name) + '" loading="lazy">' +
      '<span class="lab-product-number">اختيار ' + (i+1) + '</span></a>' +
      '<div class="lab-product-info"><small>' + escapeText(cat.name) + '</small>' +
      '<h3>' + escapeText(p.name) + '</h3><p>' + escapeText(p.short) + '</p>' +
      '<div class="lab-product-tags">' + tags + '</div>' +
      '<div class="lab-product-actions"><a class="btn" href="product.html?id=' + p.id +
      '">اكتشف المنتج ↗</a><button type="button" class="lab-add-compare" data-compare-product="' +
      p.id + '" aria-pressed="' + selected + '">' + (selected ? '✓ تمت الإضافة' : '+ قارن') +
      '</button></div></div></article>';
  }
  function renderLab() {
    if (!stage) return;
    const steps = document.querySelectorAll('#lab-steps .lab-step');
    steps.forEach((s,i) => {
      s.classList.toggle('active', i === Math.min(labStep,2));
      s.classList.toggle('done', i < Math.min(labStep,3));
    });
    const fill = $('#lab-progress');
    if (fill) fill.style.width = [33.33,66.66,85,100][labStep] + '%';
    if (labStep === 0) {
      stage.innerHTML = '<span class="lab-intro-label">01 / YOUR INTEREST</span>' +
        '<h2>ما المجال الذي يهمك اليوم؟</h2>' +
        '<p class="lab-stage-lead">اختر قسمًا لتظهر لك خيارات من منتجات المتجر الحقيقية.</p>' +
        '<div class="lab-options">' +
        Object.entries(categories).map(([key,cat]) =>
          buttonOption(cat.name, cat.desc, cat.icon, key)).join('') +
        '</div>';
    } else if (labStep === 1) {
      stage.innerHTML = '<span class="lab-intro-label">02 / YOUR GOAL</span>' +
        '<h2>أي اتجاه تريد استكشافه؟</h2>' +
        '<p class="lab-stage-lead">الاقتراحات مبنية على كلمات وصف المنتجات، ولا تمثل تشخيصًا أو توصية طبية.</p>' +
        '<div class="lab-options">' + (categoryGoals[chosenCategory] || []).map((g,i) =>
          buttonOption(g.label, 'استكشف المنتجات المرتبطة بهذا الاهتمام', g.icon, i)).join('') +
        '</div>' + stageActions();
    } else if (labStep === 2) {
      stage.innerHTML = '<span class="lab-intro-label">03 / YOUR STYLE</span>' +
        '<h2>كيف تحب تبدأ؟</h2>' +
        '<p class="lab-stage-lead">طريقة العرض فقط؛ لا توجد منتجات أو أسعار مخفية.</p>' +
        '<div class="lab-options">' +
        buttonOption('اختيار واحد واضح','نعرض أول منتج مطابق لوصف اهتمامك.','✦','single') +
        buttonOption('ثلاثة خيارات للمقارنة','نشاهد أبرز ثلاثة منتجات من هذا القسم.','⚖','set') +
        '</div>' + stageActions();
    } else {
      const eligible = products.filter(p => p.category === chosenCategory);
      const sorted = eligible.map((p,i) => ({p,i,s:scoreProduct(p,chosenGoal.words)}))
        .sort((a,b) => b.s-a.s || a.i-b.i).slice(0,chosenSet==='single'?1:3).map(x=>x.p);
      stage.innerHTML = '<span class="lab-intro-label">YOUR PERSONAL EDIT</span>' +
        '<h2>هذه خيارات تستحق الاستكشاف ✨</h2>' +
        '<p class="lab-stage-lead">نتائج مستخرجة من بيانات الكتالوج حسب اهتمامك: ' +
          escapeText(chosenGoal.label) + '.</p>' +
        '<div class="lab-result-banner"><div><h3>اختيارات من ' +
          escapeText(categories[chosenCategory].name) + '</h3>' +
          '<p>قارن المكونات الوصفية وطريقة الاستخدام، ثم تأكد من السعر والتوفر عبر المتجر.</p></div>' +
          '<span class="lab-result-badge">' + escapeText(categories[chosenCategory].icon) + '</span></div>' +
        (sorted.length ? '<div class="lab-grid">' + sorted.map(labCard).join('') + '</div>' :
          '<div class="lab-empty">لا توجد منتجات متاحة في هذا القسم حاليًا.</div>') +
        '<p class="lab-disclaimer">هذه أداة لاكتشاف الكتالوج فقط؛ ليست تقييمًا علاجيًا أو نصيحة طبية.</p>' +
        '<div class="lab-bottom-strip"><button type="button" class="btn" data-lab-action="restart">' +
          '↻ ابدأ تجربة جديدة</button><a href="compare.html">افتح لوحة المقارنة ⚖</a>' +
          '<a href="categories.html">عرض كل المنتجات ←</a></div>';
      syncCompareUI();
    }
  }
  if (stage) {
    stage.addEventListener('click', event => {
      const action = event.target.closest('[data-lab-action]');
      if (action) {
        if (action.dataset.labAction === 'restart') {
          labStep = 0; chosenCategory = chosenGoal = chosenSet = null;
        } else labStep = Math.max(0,labStep-1);
        renderLab();
        stage.scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }
      const compare = event.target.closest('.lab-add-compare');
      if (compare) {toggleCompared(compare.dataset.compareProduct);return;}
      const selected = event.target.closest('.lab-opt');
      if (!selected) return;
      if (labStep === 0) {
        chosenCategory = selected.dataset.value;
        if (!categoryGoals[chosenCategory]) return;
        labStep = 1;
      } else if (labStep === 1) {
        chosenGoal = categoryGoals[chosenCategory][Number(selected.dataset.value)];
        if (!chosenGoal) return;
        labStep = 2;
      } else if (labStep === 2) {
        chosenSet = selected.dataset.value;
        labStep = 3;
      }
      renderLab();
      stage.scrollIntoView({behavior:'smooth',block:'start'});
    });
    renderLab();
  }

  // Comparison board. Up to 3 real products, without claiming verified prices.
  const compareHost = $('#compare-content');
  const compareSelect = $('#compare-product-select');
  if (compareSelect) {
    Object.entries(categories).forEach(([key,cat]) => {
      const group = document.createElement('optgroup');
      group.label = cat.name;
      products.filter(p => p.category === key).forEach(p => {
        const option = document.createElement('option');
        option.value = String(p.id);
        option.textContent = p.name;
        group.appendChild(option);
      });
      compareSelect.appendChild(group);
    });
    $('#compare-add').addEventListener('click', () => {
      if (!compareSelect.value) {message('اختر منتجًا أولًا');return;}
      toggleCompared(compareSelect.value);
      compareSelect.value = '';
    });
  }
  function renderComparison() {
    if (!compareHost) return;
    const chosen = readCompared().map(byId).filter(Boolean);
    if (!chosen.length) {
      compareHost.innerHTML = '<div class="compare-grid-scroll compare-empty">' +
        '<strong>ابدأ المقارنة بمنتج واحد ✨</strong>' +
        '<p>اختر منتجًا من القائمة أعلاه أو اضغط «قارن» على أي بطاقة منتج في المتجر.</p>' +
        '<a class="btn" href="discover.html">استكشف المنتجات ←</a></div>';
      return;
    }
    const rows = [
      ['القسم',p => escapeText(categories[p.category]?.name || p.category)],
      ['وصف مختصر',p => escapeText(p.short || p.desc)],
      ['أبرز المميزات',p => Array.isArray(p.highlights) && p.highlights.length ?
        '<ul class="compare-list">' + p.highlights.map(x => '<li>' + escapeText(x) + '</li>').join('') +
        '</ul>' : 'حسب وصف المنتج'],
      ['طريقة الاستخدام',p => escapeText(p.usage || 'راجع تعليمات المنتج قبل الاستخدام')],
      ['تنبيهات',p => escapeText(p.warning || 'تأكد من التعليمات والمكونات على العبوة')],
      ['السعر والتوفر',() => 'يُؤكَّد عند التواصل مع المتجر'],
      ['استفسار وطلب',p => '<button class="btn" data-ask-id="' + p.id + '" type="button">اسأل عبر واتساب ↗</button>']
    ];
    const header = '<thead><tr><th scope="col">المعيار</th>' + chosen.map(p =>
      '<td><div class="compare-product-header"><a href="product.html?id=' + p.id +
      '"><img src="' + escapeText(p.image) + '" alt="' + escapeText(p.name) + '"><b>' +
      escapeText(p.name) + '</b></a><button type="button" data-remove-id="' + p.id +
      '">× إزالة من المقارنة</button></div></td>').join('') + '</tr></thead>';
    const body = '<tbody>' + rows.map(([title,getCell]) =>
      '<tr><th scope="row">' + escapeText(title) + '</th>' +
      chosen.map(p => '<td>' + getCell(p) + '</td>').join('') + '</tr>').join('') + '</tbody>';
    compareHost.innerHTML = '<div class="compare-grid-scroll"><table class="compare-table">' +
      header + body + '</table></div>' +
      '<p class="lab-disclaimer">اختر منتجًا إضافيًا من القائمة في الأعلى (حتى ثلاثة منتجات).</p>';
  }
  if (compareHost) {
    compareHost.addEventListener('click', event => {
      const remove = event.target.closest('[data-remove-id]');
      if (remove) {toggleCompared(remove.dataset.removeId);return;}
      const ask = event.target.closest('[data-ask-id]');
      if (ask) window.productWhatsApp(ask.dataset.askId);
    });
    renderComparison();
  }
  syncCompareUI();
})();
