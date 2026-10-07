
window.storeProducts=[
{id:1,name:"خلطة عناية وتفتيح طبيعية",category:"skin",price:4000,rating:"4.9",reviews:132,image:"https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=82",desc:"خلطة تجريبية لعرض شكل صفحة المنتج. سنستبدل الاسم والوصف والصورة بالمعلومات الحقيقية لاحقًا."},
{id:2,name:"زيت إكليل الجبل للشعر",category:"hair",price:3500,rating:"4.8",reviews:98,image:"https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=900&q=82",desc:"زيت عناية للشعر ضمن العرض التجريبي للمتجر."},
{id:3,name:"صابون طبيعي بالأعشاب",category:"herbs",price:2500,rating:"4.7",reviews:54,image:"https://images.unsplash.com/photo-1607006344380-b6775a0824a7?auto=format&fit=crop&w=900&q=82",desc:"صابون أعشاب تجريبي ضمن واجهة المتجر."},
{id:4,name:"ماسك أعشاب للوجه",category:"face",price:3000,rating:"4.9",reviews:76,image:"https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=900&q=82",desc:"ماسك أعشاب تجريبي لصفحة العناية بالوجه."},
{id:5,name:"زيت عناية للشعر",category:"hair",price:3000,rating:"4.8",reviews:89,image:"https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=82",desc:"زيت عناية تجريبي للشعر."},
{id:6,name:"بودرة أعشاب للعناية",category:"herbs",price:3000,rating:"4.8",reviews:120,image:"https://images.unsplash.com/photo-1600428853876-fb5a850b444f?auto=format&fit=crop&w=900&q=82",desc:"بودرة أعشاب تجريبية ضمن قسم الخلطات."},
{id:7,name:"ماسك طين طبيعي للوجه",category:"face",price:2800,rating:"4.8",reviews:61,image:"https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=900&q=82",desc:"ماسك تجريبي للعناية بالوجه ضمن عرض المتجر."},
{id:8,name:"كريم ترطيب وعناية بالبشرة",category:"skin",price:3800,rating:"4.7",reviews:83,image:"https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=900&q=82",desc:"كريم تجريبي لعرض شكل منتجات العناية بالبشرة."}
];
window.money=n=>Number(n).toLocaleString("ar-YE")+" ر.ي";
window.getCart=()=>JSON.parse(localStorage.getItem("umTurkiCart")||"[]");
window.getFav=()=>JSON.parse(localStorage.getItem("umTurkiFav")||"[]");
window.saveCart=c=>localStorage.setItem("umTurkiCart",JSON.stringify(c));
window.saveFav=f=>localStorage.setItem("umTurkiFav",JSON.stringify(f));
window.cartCount=()=>getCart().reduce((s,x)=>s+x.qty,0);
window.updateBadges=()=>document.querySelectorAll(".cart-count").forEach(el=>el.textContent=cartCount());
window.addToCart=id=>{let c=getCart(),i=c.find(x=>x.id===id);i?i.qty++:c.push({id,qty:1});saveCart(c);updateBadges();};
window.toggleFav=id=>{let f=getFav(),i=f.indexOf(id);i>-1?f.splice(i,1):f.push(id);saveFav(f);return f.includes(id)};
window.checkoutWhatsApp=()=>{
 let c=getCart(); if(!c.length)return alert("السلة فارغة");
 let total=0,lines=["مرحبًا، أريد تأكيد هذا الطلب من متجر أم تركي:",""];
 c.forEach(i=>{let p=storeProducts.find(x=>x.id===i.id);if(p){lines.push("• المنتج: "+p.name,"  الكمية: "+i.qty,"  سعر الوحدة: "+money(p.price),"  إجمالي المنتج: "+money(p.price*i.qty),"");total+=p.price*i.qty;}});
 lines.push("الإجمالي: "+money(total),"طريقة الدفع المفضلة: الدفع عند الاستلام","أرجو تأكيد التوصيل.");
 window.open("https://wa.me/967776436212?text="+encodeURIComponent(lines.join("\n")),"_blank","noopener");
};
updateBadges();
