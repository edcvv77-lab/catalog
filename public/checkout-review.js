(() => {
  const form = document.getElementById("checkoutForm");
  const summary = document.getElementById("orderMini");
  const dialog = document.querySelector(".order-review");
  const link = dialog.querySelector(".review-whatsapp");
  const number = new Intl.NumberFormat("ar",{numberingSystem:"arab"});
  const details = () => getCart().map(item => ({ item, product:productById(item.id) })).filter(row => row.product);
  let prepared = null;
  const phone = form.elements.phone;

  function normalizePhone(value) {
    return value.trim().replace(/[٠-٩۰-۹]/g,ch => String(ch.charCodeAt(0) - (ch < "۰" ? 0x660 : 0x6f0))).replace(/[\s()\-]/g,"");
  }

  function isPhoneValid() {
    phone.setCustomValidity(/^\+?\d{7,15}$/.test(normalizePhone(phone.value)) ? "" : "اكتبي رقم هاتف صحيحًا يحتوي على ٧ إلى ١٥ رقمًا.");
  }

  const rows = details();
  if (!rows.length) {
    document.querySelector(".checkout-layout").hidden = true;
    document.querySelector(".checkout-empty").hidden = false;
    return;
  }
  rows.forEach(({item,product}) => {
    const row = document.createElement("div");
    row.className = "order-mini-item";
    const img = document.createElement("img");
    img.src = product.image;
    img.alt = "";
    const info = document.createElement("div");
    const title = document.createElement("h3");
    const qty = document.createElement("span");
    title.textContent = product.name;
    qty.textContent = "الكمية: " + number.format(item.qty);
    info.append(title,qty);
    row.append(img,info);
    summary.append(row);
  });
  document.getElementById("pieces").textContent = number.format(rows.reduce((sum,{item}) => sum + item.qty,0));
  phone.addEventListener("input",() => phone.setCustomValidity(""));
  for (const key of ["name","area","address"]) {
    form.elements[key].addEventListener("input",() => form.elements[key].setCustomValidity(""));
  }

  form.addEventListener("submit",event => {
    event.preventDefault();
    for (const key of ["name","area","address"]) {
      const input = form.elements[key];
      input.setCustomValidity(input.value.trim() ? "" : "هذا الحقل مطلوب.");
    }
    isPhoneValid();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const value = key => String(data.get(key) || "").trim();
    const currentRows = details();
    if (!currentRows.length) {
      window.location.href = "cart.html";
      return;
    }
    const id = "UT-" + Date.now().toString().slice(-8);
    const lines = [
      "مرحبًا، أريد تأكيد طلب من متجر أم تركي:",
      "رقم الطلب: " + id, "",
      "الاسم: " + value("name"),
      "الهاتف: " + normalizePhone(value("phone")),
      "المدينة / المنطقة: " + value("area"),
      "العنوان: " + value("address")
    ];
    if (value("landmark")) lines.push("أقرب معلم: " + value("landmark"));
    lines.push("", "المنتجات:");
    for (const {item,product} of currentRows) lines.push(`• ${product.name} × ${item.qty}`);
    lines.push("", "طريقة الدفع المفضلة: " + value("payment"));
    if (value("note")) lines.push("ملاحظات: " + value("note"));
    lines.push("أرجو تأكيد الأسعار والتوفر ورسوم التوصيل.");
    const message = lines.join("\n");
    prepared = { id, createdAt:new Date().toISOString(), items:currentRows.map(({item})=>({id:item.id,qty:item.qty})) };
    dialog.querySelector(".order-message").textContent = message;
    link.href = `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(message)}`;
    dialog.showModal();
  });
  link.addEventListener("click",event => {
    if (!prepared) { event.preventDefault(); return; }
    try { localStorage.setItem("umTurkiLastOrder",JSON.stringify(prepared)); } catch {}
  });
})();
