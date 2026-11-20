(() => {
  const page = location.pathname.split("/").pop().replace(/\.html$/,"");
  if (!document.querySelector('link[href^="cinema-commerce.css"]')) {
    const theme = document.createElement("link");
    theme.rel = "stylesheet";
    theme.href = "cinema-commerce.css?v=3";
    document.head.appendChild(theme);
  }
  document.body.classList.add("commerce", `commerce-${page}`);
  if (document.querySelector("#grid,#related")) {
    const art = document.createElement("script");
    art.src = "product-art.js";
    document.head.appendChild(art);
  }
  document.querySelector(".site-header .back")?.setAttribute("aria-label","رجوع");
  document.querySelector('.site-header .head-action[href="cart.html"]')?.setAttribute("aria-label","السلة");
  const brand = document.querySelector(".site-header .leaf");
  if (brand) {
    brand.setAttribute("aria-hidden","true");
    brand.innerHTML = '<svg viewBox="0 0 40 40" fill="none"><path d="M20 31c0-12 4-18 12-22 0 8-4 14-12 16M20 28C12 26 8 21 8 14c7 1 11 5 12 11M20 22c-4-5-4-10 0-15 4 5 4 10 0 15Z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  const pageHero = document.querySelector(".page-hero");
  const labels = {
    categories:"دليل عناية أم تركي",
    cart:"مراجعة المنتجات والكميات",
    checkout:"الخطوة الأخيرة قبل التواصل",
    favorites:"اختياراتك المحفوظة",
    discover:"اختاري بحسب احتياجك",
    compare:"قارني قبل الطلب"
  };
  if (pageHero && labels[page]) {
    const tag = document.createElement("p");
    tag.className = "commerce-eyebrow";
    tag.textContent = labels[page];
    pageHero.prepend(tag);
  }
  if (page === "categories") {
    document.getElementById("q")?.setAttribute("aria-label","ابحثي عن منتج في الكتالوج");
    const description = pageHero?.querySelector("p:not(.commerce-eyebrow)");
    if (description) description.textContent = "تصفّحي الأقسام أو ابحثي عن منتج. نؤكّد السعر والتوفر عند التواصل.";
  }
  if (pageHero && (page === "cart" || page === "checkout")) {
    const steps = document.createElement("ol");
    steps.className = "order-steps";
    steps.setAttribute("aria-label","مراحل الطلب");
    const current = page === "cart" ? 0 : 1;
    for (const [index,title] of ["مراجعة السلة","بيانات التوصيل","الإرسال عبر واتساب"].entries()) {
      const step = document.createElement("li");
      const number = document.createElement("span");
      number.textContent = ["٠١","٠٢","٠٣"][index];
      number.setAttribute("aria-hidden","true");
      step.append(number,document.createTextNode(title));
      if (index === current) step.setAttribute("aria-current","step");
      steps.appendChild(step);
    }
    pageHero.after(steps);
  }
  if (page === "cart") {
    const note = document.querySelector("#summary > div:last-child");
    if (note) note.textContent = "ما يتم تحصيل أي مبلغ هنا. نؤكّد الأسعار والتوصيل معك عبر واتساب.";
  }
})();
