/* One-tap product discovery: choose a category and results appear immediately. */
(() => {
  'use strict';
  const products = Array.isArray(window.storeProducts) ? window.storeProducts : [];
  const categories = window.storeCategories || {};
  const grid = document.getElementById('grid');
  if (!grid) return;
  const categoryBar = document.getElementById('easy-categories');
  const interestBar = document.getElementById('easy-interests');
  const search = document.getElementById('easy-query');
  const resultTitle = document.getElementById('easy-result-title');
  const resultHint = document.getElementById('easy-result-hint');
  const count = document.getElementById('easy-result-count');
  const moreWrap = document.getElementById('easy-more');
  const moreBtn = document.getElementById('easy-show-more');
  const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, x =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[x]);
  const normalize = text => String(text ?? '').normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g,'')
    .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase().trim();
  const interests = {
    skin:[
      {label:'ترطيب ونعومة',words:['ترطيب','نعومة','كريم']},
      {label:'الصابون والتنظيف',words:['صابون','صابونة','تنظيف']},
      {label:'البودرة واللون',words:['بودرة','عكر','موردة']}
    ],
    hair:[
      {label:'زيوت الشعر',words:['زيت','زيوت']},
      {label:'الشامبو والبخاخ',words:['شامبو','بخاخ']},
      {label:'الأعشاب',words:['اعشاب','مشاط']}
    ],
    eyes:[
      {label:'الرموش والحواجب',words:['رموش','حواجب']},
      {label:'محيط العين',words:['عين','هالات']}
    ],
    personal:[
      {label:'النظافة والانتعاش',words:['نظافة','انتعاش','بخاخ']},
      {label:'العناية بالأسنان',words:['اسنان','كربونكس']}
    ],
    wellness:[
      {label:'الغذاء والمكسرات',words:['غذاء','عسل','مكسرات']},
      {label:'القهوة والمشروبات',words:['قهوة','مشروب']}
    ]
  };
  const params = new URLSearchParams(location.search);
  let category = Object.prototype.hasOwnProperty.call(categories,params.get('cat')) ? params.get('cat') : 'all';
  let interest = -1;
  let shown = 8;
  search.value = params.get('q') || '';

  function categoryButton(key,label,icon) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.cat = key;
    btn.setAttribute('aria-pressed',String(category===key));
    const picture = document.createElement('span');
    picture.textContent = icon;
    const text = document.createTextNode(label);
    btn.append(picture,text);
    return btn;
  }
  function renderCategories() {
    categoryBar.replaceChildren(categoryButton('all','كل المنتجات','✦'),
      ...Object.entries(categories).map(([key,c]) => categoryButton(key,c.name,c.icon)));
  }
  function renderInterests() {
    const opts = category === 'all' ? [] : interests[category] || [];
    interestBar.replaceChildren();
    interestBar.hidden = !opts.length;
    if (!opts.length) return;
    opts.forEach((goal,i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.goal = String(i);
      btn.setAttribute('aria-pressed',String(interest===i));
      btn.textContent = goal.label;
      interestBar.appendChild(btn);
    });
    const all = document.createElement('button');
    all.type = 'button';
    all.dataset.goal = '-1';
    all.setAttribute('aria-pressed',String(interest===-1));
    all.textContent = 'عرض الكل';
    interestBar.prepend(all);
  }
  function itemSearch(p) {
    return normalize([p.name,p.short,p.desc,(p.highlights||[]).join(' '),
      categories[p.category]?.name].join(' '));
  }
  function filteredItems() {
    const q=normalize(search.value);
    const words=interest>=0 ? (interests[category]?.[interest]?.words||[]) : [];
    const result=products.filter(p => {
      if(category!=='all' && p.category!==category)return false;
      const full=itemSearch(p);
      if(q && !full.includes(q))return false;
      if(words.length && !words.some(w => full.includes(normalize(w))))return false;
      return true;
    });
    if(category==='all' && !q){
      return result.sort((a,b)=>Number(b.featured)-Number(a.featured));
    }
    return result;
  }
  function productCard(p) {
    const fav = window.getFav().includes(p.id);
    return '<article class="product">' +
      '<div class="product-img"><a href="product.html?id='+Number(p.id)+'">'+
      '<img loading="lazy" src="'+escapeHtml(p.image)+'" alt="'+escapeHtml(p.name)+'"></a></div>' +
      '<div class="product-body"><div class="product-category">'+
      escapeHtml(categories[p.category]?.icon || '✦')+' '+
      escapeHtml(categories[p.category]?.name || p.category)+'</div>'+
      '<a href="product.html?id='+Number(p.id)+'"><h3>'+escapeHtml(p.name)+'</h3></a>'+
      '<p class="product-short">'+escapeHtml(p.short || '')+'</p>'+
      '<div class="price-contact">تواصل معنا للسعر</div>'+
      '<div class="product-actions-mini"><button type="button" class="btn" data-add-id="'+Number(p.id)+'">أضف للسلة 🛒</button></div>'+
      '</div></article>';
  }
  function render() {
    renderCategories();
    renderInterests();
    const matches = filteredItems();
    const visible = matches.slice(0,shown);
    const title = category==='all'?'منتجاتنا لك':categories[category].name;
    resultTitle.textContent = title;
    resultHint.textContent = search.value.trim()?'نتائج بحثك تظهر هنا فورًا':
      interest>=0?'منتجات مرتبطة باهتمامك من وصف الكتالوج':'تصفح المنتجات واختر ما يعجبك.';
    count.textContent = matches.length+' منتج';
    if(!matches.length){
      grid.innerHTML='<div class="easy-empty"><h3>ما لقينا نتيجة مطابقة</h3><p>جرّب كلمة مختلفة، أو اعرض منتجات القسم كلها.</p><button type="button" class="btn alt" data-reset="true">عرض كل المنتجات</button></div>';
    }else{
      grid.innerHTML=visible.map(productCard).join('');
    }
    moreWrap.hidden = matches.length<=shown;
  }
  categoryBar.addEventListener('click',event=>{
    const btn=event.target.closest('button[data-cat]');
    if(!btn)return;
    category=btn.dataset.cat;
    interest=-1;
    shown=8;
    render();
  });
  interestBar.addEventListener('click',event=>{
    const btn=event.target.closest('button[data-goal]');
    if(!btn)return;
    const next=Number(btn.dataset.goal);
    interest=interest===next?-1:next;
    shown=8;
    render();
  });
  search.addEventListener('input',()=>{shown=8;render()});
  moreBtn.addEventListener('click',()=>{shown+=8;render()});
  grid.addEventListener('click',event=>{
    const reset=event.target.closest('[data-reset]');
    if(reset){
      category='all';interest=-1;search.value='';shown=8;render();return;
    }
    const add=event.target.closest('button[data-add-id]');
    if(!add)return;
    const id=Number(add.dataset.addId);
    window.addToCart(id);
    window.updateBadges();
    add.textContent='تمت الإضافة ✓';
    add.disabled=true;
    setTimeout(()=>{if(add.isConnected){add.textContent='أضف للسلة 🛒';add.disabled=false;}},1500);
  });
  render();
})();
