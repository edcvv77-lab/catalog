import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext, Script} from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const pages=['index','categories','product','cart','favorites','checkout','about'];

test('storefront pages reference new enhancement assets',()=>{
  assert.ok(existsSync(resolve(root,'public/premium.css')));
  assert.ok(existsSync(resolve(root,'public/store-experience.js')));
  for(const page of pages){
    const html=read('public/'+page+'.html');
    assert.match(html,/<html\b[^>]*lang="ar"[^>]*dir="rtl"/);
    assert.match(html,/<link rel="stylesheet" href="premium\.css">/);
    assert.match(html,/<script src="store-experience\.js" defer><\/script>/);
    assert.match(html,/<\/head>/);
    assert.match(html,/<\/body>/);
  }
});

test('existing and new inline JavaScript parses successfully',()=>{
  for (const page of pages){
    const html=read('public/'+page+'.html');
    const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    for(const [,content] of scripts)if(content.trim())assert.doesNotThrow(
      ()=>new Script(content,{filename:page+'.html:inline-script'}));
  }
  for(const file of ['public/store-data.js','public/store-experience.js']){
    assert.doesNotThrow(()=>new Script(read(file),{filename:file}));
  }
});

test('store catalog contains unique IDs and existing product images',()=>{
  const map=new Map();
  const localStorage={
    getItem:key=>map.has(key)?map.get(key):null,
    setItem:(key,value)=>map.set(key,String(value)),
    removeItem:key=>map.delete(key)
  };
  const sandbox={localStorage,document:{querySelectorAll:()=>[]}};
  sandbox.window=sandbox;
  runInNewContext(read('public/store-data.js'),sandbox,{filename:'store-data.js'});
  const products=Array.from(sandbox.storeProducts);
  assert.ok(products.length>=20,'expected the existing real product catalog');
  assert.equal(new Set(products.map(p=>p.id)).size,products.length);
  for(const p of products){
    assert.ok(p.name && p.category);
    assert.ok(sandbox.storeCategories[p.category],'invalid category for '+p.name);
    assert.ok(existsSync(resolve(root,'public',p.image)),'missing image for '+p.name);
  }
  assert.ok(sandbox.storeSearch('أفيورا').length>0);
});

test('checkout, favorites and cart remain available',()=>{
  for (const page of ['public/cart.html','public/checkout.html','public/favorites.html']){
    assert.ok(existsSync(resolve(root,page)));
  }
});

test('premium store and discovery pages have their complete local assets',()=>{
  for(const page of pages){
    const html=read('public/'+page+'.html');
    assert.match(html,/href="showcase\.css"/);
    assert.match(html,/src="showcase\.js"/);
  }
  for(const page of ['discover','compare']){
    const html=read('public/'+page+'.html');
    assert.match(html,/<html\b[^>]*lang="ar"[^>]*dir="rtl"/);
    assert.match(html,/href="showcase\.css"/);
    assert.match(html,/src="store-data\.js"/);
    assert.match(html,/src="showcase\.js"/);
    assert.match(html,/<main\b/);
  }
  for(const file of ['public/showcase.js','public/store-experience.js']){
    assert.doesNotThrow(()=>new Script(read(file),{filename:file}));
  }
  assert.ok(read('public/showcase.css').includes('prefers-reduced-motion'));
});

function appHarness(page){
  const map=new Map();
  const storage={
    getItem:key=>map.has(key)?map.get(key):null,
    setItem:(key,val)=>map.set(key,String(val)),
    removeItem:key=>map.delete(key)
  };
  const stubs=[];
  const element=(tag='div')=>({
    tagName:tag.toUpperCase(),
    style:{},children:[],dataset:{},textContent:'',innerHTML:'',
    classList:{add(){},remove(){},toggle(){}},
    setAttribute(){},removeAttribute(){},
    addEventListener(type,fn){this['on'+type]=fn;},
    appendChild(child){this.children.push(child);},
    querySelector(){return element('span');},
    closest(){return null;},
    scrollIntoView(){}
  });
  const stage=element('section'),bar=element('div'),compare=element('section');
  const select=element('select'),addButton=element('button');
  const mapping={
    '#lab-stage':page==='discover'?stage:null,
    '#lab-progress':page==='discover'?bar:null,
    '#compare-content':page==='compare'?compare:null,
    '#compare-product-select':page==='compare'?select:null,
    '#compare-add':page==='compare'?addButton:null
  };
  const document={
    body:element('body'),
    querySelector:s=>mapping[s]||null,
    querySelectorAll:()=>[],
    createElement:tag=>element(tag)
  };
  const scope={
    document,localStorage:storage,location:{pathname:'/'+page+'.html'},
    MutationObserver:class{observe(){}},
    setTimeout:()=>1,clearTimeout(){},
    URLSearchParams,console
  };
  scope.window=scope;
  runInNewContext(read('public/store-data.js'),scope);
  runInNewContext(read('public/showcase.js'),scope);
  return {scope,stage,bar,compare,select,addButton,map};
}
function fakeClick(value) {
  return {target:{closest(selector){
    if(selector==='.lab-opt')return {dataset:{value}};
    return null;
  }}};
}
test('guided discovery traverses all three choices and yields real products',()=>{
  const app=appHarness('discover');
  assert.match(app.stage.innerHTML,/ما المجال الذي يهمك/);
  app.stage.onclick(fakeClick('skin'));
  assert.match(app.stage.innerHTML,/ترطيب ونعومة/);
  app.stage.onclick(fakeClick('0'));
  assert.match(app.stage.innerHTML,/كيف تحب تبدأ/);
  app.stage.onclick(fakeClick('set'));
  assert.match(app.stage.innerHTML,/lab-product/);
  assert.match(app.stage.innerHTML,/أفيورا|كريم|مورّدة|صابونة|النيلة/);
  assert.equal(app.bar.style.width,'100%');
});
test('comparison board adds a real product and renders descriptions',()=>{
  const app=appHarness('compare');
  assert.match(app.compare.innerHTML,/ابدأ المقارنة/);
  app.select.value='1';
  app.addButton.onclick();
  assert.match(app.compare.innerHTML,/بخاخ أمان/);
  assert.match(app.compare.innerHTML,/طريقة الاستخدام/);
  assert.match(app.compare.innerHTML,/عند التواصل مع المتجر/);
  assert.deepEqual(JSON.parse(app.map.get('umTurkiCompareV1')),[1]);
});


test('new streamlined paths are styled, accessible, and retain the full shopping flow',()=>{
  const homepage=read('public/index.html');
  const discovery=read('public/discover.html');
  assert.match(homepage,/href="flow\.css"/);
  assert.match(homepage,/href="categories\.html"/);
  assert.match(homepage,/href="cart\.html"/);
  assert.match(homepage,/href="discover\.html"/);
  assert.match(homepage,/id="homeSearch"/);
  assert.match(homepage,/class="[^"]*simple-hero[^"]*"/);
  assert.match(discovery,/href="easy-discover\.css"/);
  assert.match(discovery,/src="easy-discover\.js"/);
  assert.match(discovery,/id="easy-categories"/);
  assert.match(discovery,/id="easy-query"/);
  assert.match(discovery,/id="grid"/);
  assert.doesNotMatch(discovery,/id="lab-stage"/);
  for (const asset of ['flow.css','easy-discover.css','easy-discover.js']){
    assert.ok(existsSync(resolve(root,'public',asset)),'missing '+asset);
  }
  assert.match(read('public/flow.css'),/prefers-reduced-motion/);
  assert.match(read('public/easy-discover.css'),/prefers-reduced-motion/);
  assert.doesNotThrow(()=>new Script(read('public/easy-discover.js')));
  assert.match(read('public/store-experience.js'),/\.simple-search/);
});

test('one-tap discovery renders real products and filters instantly',()=>{
  const nodes=new Map();
  const makeNode=(tag='div')=>({
    tagName:tag.toUpperCase(),dataset:{},children:[],textContent:'',innerHTML:'',
    hidden:false,value:'',style:{},attributes:{},
    setAttribute(k,v){this.attributes[k]=String(v);},
    replaceChildren(...items){this.children=[...items];},
    append(...items){this.children.push(...items);},
    appendChild(item){this.children.push(item);},
    prepend(item){this.children.unshift(item);},
    addEventListener(k,fn){this['on'+k]=fn;},
    closest(){return null;}
  });
  for(const id of ['grid','easy-categories','easy-interests','easy-query','easy-result-title',
                   'easy-result-hint','easy-result-count','easy-more','easy-show-more']){
    nodes.set(id,makeNode(id==='easy-query'?'input':'div'));
  }
  const memory=new Map();
  const localStorage={
    getItem:k=>memory.get(k)??null,
    setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)
  };
  const document={
    getElementById:id=>nodes.get(id)||null,
    querySelectorAll:()=>[],
    createElement:makeNode,
    createTextNode:txt=>({textContent:txt})
  };
  const scope={document,localStorage,location:{search:'',pathname:'/discover.html'},
               URLSearchParams,setTimeout:()=>1};
  scope.window=scope;
  runInNewContext(read('public/store-data.js'),scope);
  runInNewContext(read('public/easy-discover.js'),scope);
  const grid=nodes.get('grid'),cats=nodes.get('easy-categories'),search=nodes.get('easy-query');
  const count=nodes.get('easy-result-count');
  assert.match(grid.innerHTML,/product-img/);
  assert.match(count.textContent,/منتج/);
  assert.equal(cats.children.length,Object.keys(scope.storeCategories).length+1);
  cats.onclick({target:{closest:s=>s==='button[data-cat]'?{dataset:{cat:'hair'}}:null}});
  assert.match(nodes.get('easy-result-title').textContent,/الشعر/);
  assert.match(grid.innerHTML,/شعر|مشاط|زيت|شامبو/);
  search.value='مشاط';
  search.oninput();
  assert.match(grid.innerHTML,/مشاط/);
  assert.ok(Number.parseInt(count.textContent)>=1);
  search.value='';
  search.oninput();
  grid.onclick({target:{closest:s=>s==='button[data-add-id]'?{dataset:{addId:'15'},textContent:'',isConnected:true}:null}});
  assert.ok(scope.getCart().some(x=>x.id===15));
});


test('category images are art-directed consistently on mobile without losing originals',()=>{
  const css=read('public/card-images.css');
  for(const page of ['index','categories','discover','favorites','product','cart']){
    const html=read('public/'+page+'.html');
    assert.match(html,/<link rel="stylesheet" href="card-images\.css">/);
  }
  assert.match(css,/\.simple-home \.simple-category > img/);
  assert.match(css,/object-fit:cover/);
  assert.match(css,/\.cat-grid \.cat-card > img/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.product-detail \.detail-img img/);
  assert.match(css,/object-fit:contain/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  for(const img of Object.values((()=>{
    const data=read('public/store-data.js');
    const matched=[...data.matchAll(/image:"([^"]+\.webp)"/g)];
    return Object.fromEntries(matched.map((m,i)=>[i,m[1]]));
  })())){
    assert.ok(existsSync(resolve(root,'public',img)), 'original image missing: '+img);
  }
});
