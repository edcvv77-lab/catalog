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