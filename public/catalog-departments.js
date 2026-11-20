(() => {
  const hero = document.querySelector(".catalog-hero");
  const heading = document.getElementById("catalogHeading");
  const kicker = document.getElementById("catalogKicker");
  const intro = document.getElementById("catalogIntro");
  const total = document.getElementById("catalogTotal");
  const art = document.getElementById("catalogArt");
  const numbers = new Intl.NumberFormat("ar",{numberingSystem:"arab"});
  const designs = {
    all: { title:"كل خيارات العناية.", text:"تصفّحي منتجات أم تركي أو اختاري القسم المناسب لروتينك.", products:[[10,"40% 41%"],[6,"61% 53%"]] },
    skin: { title:"لحظة لبشرتكِ.", text:"من صابون أفيورا إلى الكريمات والبودرات؛ تصفّحي خيارات العناية اليومية بالبشرة.", products:[[6,"62% 52%"],[11,"43% 44%"]] },
    hair: { title:"من الجذور إلى الأطراف.", text:"تعرّفي على شامبو أروارا وزيوت الشعر ومنتجات العناية بفروة الرأس.", products:[[10,"35% 39%"],[5,"74% 47%"]] },
    eyes: { title:"التفاصيل الصغيرة.", text:"تصفّحي منتجات العناية بمحيط العين والرموش والحواجب، واقرئي تفاصيل كل منتج قبل اختياره.", products:[[12,"48% 55%"],[20,"58% 49%"]] },
    personal: { title:"انتعاش لكل يوم.", text:"اختاري من منتجات أم تركي للعناية الشخصية، من مزيل العرق إلى العناية بالأسنان.", products:[[4,"46% 56%"],[3,"52% 52%"]] },
    wellness: { title:"من رفّ التغذية.", text:"تعرّفي على الخلطات الغذائية ومنتجات هذا القسم، وراجعي المكونات وطريقة الاستخدام قبل الطلب.", products:[[13,"51% 56%"],[17,"52% 52%"]] }
  };

  function render(key) {
    const category = Object.hasOwn(designs,key) ? key : "all";
    const design = designs[category];
    hero.dataset.catalog = category;
    kicker.textContent = category === "all" ? "كتالوج أم تركي" : categoryName(category);
    heading.textContent = design.title;
    intro.textContent = design.text;
    total.textContent = "المنتجات: " + numbers.format(storeProducts.filter(p => category === "all" || p.category === category).length);
    art.replaceChildren();
    for (const [index,[id,focus]] of design.products.entries()) {
      const product = productById(id);
      if (!product) continue;
      const link = document.createElement("a");
      link.className = `catalog-shot shot-${index + 1}`;
      link.href = `product.html?id=${product.id}`;
      link.setAttribute("aria-label",product.name);
      link.style.setProperty("--subject",focus);
      const image = new Image();
      image.src = product.image;
      image.alt = "";
      image.decoding = "async";
      const label = document.createElement("span");
      label.textContent = product.name;
      link.append(image,label);
      art.append(link);
    }
    document.title = `${category === "all" ? "المنتجات والأقسام" : categoryName(category)} | متجر أم تركي`;
  }

  render(new URLSearchParams(location.search).get("cat") || "all");
  document.addEventListener("catalog:category",event => render(event.detail));
})();
