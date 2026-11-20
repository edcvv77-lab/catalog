import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { once } from "node:events";
import { join } from "node:path";
import assert from "node:assert/strict";

const base = process.env.STORE_URL || "http://127.0.0.1:8767/";
const chrome = process.env.BROWSER_EXE || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const temp = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA,"Temp","opencode") : process.env.TEMP;
const profile = await mkdtemp(join(temp,"umm-turki-mobile-"));
const browser = spawn(chrome,[
  "--headless","--no-first-run","--no-default-browser-check",
  "--remote-debugging-port=0",`--user-data-dir=${profile}`,"about:blank"
],{stdio:["ignore","ignore","pipe"]});
const debug = await new Promise((resolve,reject) => {
  const timer = setTimeout(()=>reject(new Error("Chrome did not start")),12000);
  browser.once("error",error=>{clearTimeout(timer);reject(error);});
  browser.stderr.on("data",chunk=>{
    const match = chunk.toString().match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+)\//);
    if (match) { clearTimeout(timer); resolve(match[1].replace("ws:","http:")); }
  });
});
const target = await fetch(`${debug}/json/new?about:blank`,{method:"PUT"}).then(r=>r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await once(socket,"open");
let id = 0;
const pending = new Map(), events = new Map();
socket.addEventListener("message",event=>{
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const {resolve,reject} = pending.get(msg.id);
    pending.delete(msg.id);
    if(msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
  }
  if (events.has(msg.method)) {
    const notify = events.get(msg.method);
    events.delete(msg.method);
    notify();
  }
});
const send = (method,params={}) => new Promise((resolve,reject)=>{
  pending.set(++id,{resolve,reject});
  socket.send(JSON.stringify({id,method,params}));
});
async function js(expression) {
  const response = await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}
async function navigate(path) {
  const loaded = new Promise((resolve,reject)=>{
    const timer = setTimeout(()=>{events.delete("Page.loadEventFired");reject(new Error("Page did not load: "+path));},15000);
    events.set("Page.loadEventFired",()=>{clearTimeout(timer);resolve();});
  });
  await send("Page.navigate",{url:new URL(path,base).href});
  await loaded;
}

try {
  await send("Page.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled",{cacheDisabled:true});
  await send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
  await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send("Network.emulateNetworkConditions",{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
  await navigate("index.html");
  const home = await js(`({
    width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,
    firstAction:document.querySelector('.film-opening .film-cta').getBoundingClientRect().bottom<=innerHeight,
    loadMs:Math.round(performance.now()),
    heroImageBytes:performance.getEntriesByType('resource').filter(r=>/arora-shampoo|nada-herbs-spray|afiura-licorice-soap/.test(r.name)).reduce((n,r)=>n+r.encodedBodySize,0)
  })`);
  assert.deepEqual([home.width,home.overflow,home.firstAction],[390,false,true]);
  await send("Network.emulateNetworkConditions",{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await send("Emulation.setDeviceMetricsOverride",{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await navigate("categories.html?cat=hair");
  const catalog = await js(`(async()=>{
    const q=document.querySelector('#q');q.value='أروارا';q.dispatchEvent(new Event('input',{bubbles:true}));
    const image=document.querySelector('#grid .product-img img');
    image.loading='eager';
    await image.decode();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return {result:document.querySelector('#grid h3')?.textContent,cutout:!!document.querySelector('#grid .product-cutout'),overflow:document.documentElement.scrollWidth>innerWidth};
  })()`);
  assert.deepEqual(catalog,{result:"شامبو أروارا",cutout:true,overflow:false});
  await navigate("product.html?id=10");
  assert.equal(await js(`(()=>{document.querySelector('.product-actions .btn.alt').click();return getCart()[0]?.id;})()`),10);
  await navigate("cart.html");
  const cart = await js(`({items:document.querySelectorAll('.cart-row').length,overflow:document.documentElement.scrollWidth>innerWidth})`);
  assert.deepEqual(cart,{items:1,overflow:false});
  await navigate("checkout.html");
  const checkout = await js(`(()=>{
    const form=document.querySelector('#checkoutForm'),dialog=document.querySelector('dialog');
    for(const [key,value] of Object.entries({name:'عميلة تجريبية',phone:'١',area:'مدينة تجريبية',address:'عنوان تجريبي'})) form.elements[key].value=value;
    form.requestSubmit();
    const rejectsInvalid=!dialog.open;
    form.elements.phone.value='٧٧٦٠٠٠٠٠٠';
    form.elements.phone.dispatchEvent(new Event('input'));
    form.requestSubmit();
    const msg=document.querySelector('.order-message').textContent;
    const url=new URL(document.querySelector('.review-whatsapp').href);
    const result={rejectsInvalid,open:dialog.open,
      product:msg.includes('شامبو أروارا × 1'),phone:msg.includes('776000000'),
      target:url.hostname,matchingMessage:url.searchParams.get('text')===msg,
      doesNotSaveDelivery:localStorage.getItem('umTurkiCustomer')===null,
      overflow:document.documentElement.scrollWidth>innerWidth};
    dialog.close();return result;
  })()`);
  assert.deepEqual(checkout,{rejectsInvalid:true,open:true,product:true,phone:true,target:"wa.me",matchingMessage:true,doesNotSaveDelivery:true,overflow:false});
  await send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
  await navigate("index.html");
  const reduced = await js(`({pinned:document.documentElement.classList.contains('film-motion'),cta:[...document.querySelectorAll('.film-copy a.film-cta')].every(a=>!a.closest('[inert]')),overflow:document.documentElement.scrollWidth>innerWidth})`);
  assert.deepEqual(reduced,{pinned:false,cta:true,overflow:false});
  console.log(JSON.stringify({home,catalog,cart,checkout,reduced},null,2));
} finally {
  try { await send("Browser.close"); } catch {}
  socket.close();
  if (!browser.killed) browser.kill();
}
