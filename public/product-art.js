(() => {
  const containers = [...document.querySelectorAll("#featured,#grid,#related")];
  if (!containers.length) return;
  const ns = "http://www.w3.org/2000/svg";
  const palette = {
    "arora-shampoo":{ box:"28 14 116 289", fill:"#ead2c0", accent:"#ae8267", path:"M60 32Q79 25 98 30Q103 32 104 36L104 61Q104 68 111 74Q121 84 122 100L123 263Q123 274 114 278Q86 285 59 277Q49 274 48 264L47 101Q47 88 54 78Q60 69 60 62Z" },
    "afiura-licorice-soap":{ box:"114 92 161 205", fill:"#efded8", accent:"#bc8c8a", path:"M134 112Q151 103 194 103Q236 102 253 110L256 138Q260 146 263 156L266 249Q265 269 242 278Q184 286 141 273Q129 267 128 251L128 160Q128 150 135 142Z" },
    "nada-herbs-spray":{ box:"181 25 93 233", fill:"#dde6d5", accent:"#70866c", path:"M220 42Q232 39 240 43L242 72Q245 81 249 87Q254 95 255 109L255 222Q252 238 230 240Q202 239 197 225L196 113Q196 99 205 92Q215 84 216 73Z" },
    "aman-lice-spray":{ box:"77 54 107 306", fill:"#e0e8d0", accent:"#879970", path:"M118 70Q130 65 145 71L149 78L149 108Q153 116 152 142L157 147Q168 153 169 173L171 326Q170 342 133 344Q94 345 94 332L93 180Q91 160 103 150L112 144Q110 120 115 108Z" },
    "nutri-max":{ box:"23 128 243 264", fill:"#eddbc1", accent:"#bd8960", path:"M43 187Q61 150 134 148Q218 147 244 180Q255 198 252 235Q265 280 241 330Q216 373 148 378Q76 377 47 347Q34 319 37 270L34 226Q32 207 43 187Z" },
    "afiura-blue-nila-soap":{ box:"5 76 123 199", fill:"#dde0ed", accent:"#7681ac", path:"M24 94Q72 85 105 93L109 113Q117 123 117 135L114 229Q111 258 72 261Q33 258 19 239L15 138Q15 123 23 115Z" },
    "afiura-soap-collection":{ box:"10 64 260 143", fill:"#eee3cf", accent:"#ad9270", path:"M22 103Q35 90 64 98L69 89Q90 84 115 89L123 91Q156 78 175 86L180 94Q218 84 249 96L254 158Q247 173 207 171Q176 180 145 176Q117 177 84 180Q45 184 27 171Z" },
    "fresh-max":{ box:"56 237 151 137", fill:"#e7e6dc", accent:"#8796a0", path:"M89 263Q117 245 147 249Q180 256 194 280Q203 303 182 331Q164 352 132 353Q101 351 82 335Q66 321 70 295Q74 278 89 263Z" }
  };
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "product-art.css";
  document.head.appendChild(style);
  let serial = 0;
  function svgElement(name, attrs={}) {
    const node = document.createElementNS(ns,name);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
    return node;
  }
  function decorate() {
    for (const container of containers) {
      for (const image of container.querySelectorAll(".product-img img:not([data-art-ready])")) {
        const name = image.getAttribute("src")?.split("/").pop()?.replace(/\.webp$/,"");
        if (!Object.hasOwn(palette,name || "")) continue;
        const art = palette[name];
        const media = image.closest(".product-img");
        const anchor = image.closest("a");
        if (!media || !anchor) continue;
        image.dataset.artReady = "true";
        const create = () => {
          if (!image.isConnected || !image.naturalWidth) return;
          const id = `store-crop-${++serial}`;
          const svg = svgElement("svg",{viewBox:art.box,class:"product-cutout", "aria-hidden":"true"});
          const defs = svgElement("defs");
          const mask = svgElement("clipPath",{id});
          mask.append(svgElement("path",{d:art.path}));
          defs.append(mask);
          const subject = svgElement("image",{href:image.currentSrc || image.src,width:image.naturalWidth,height:image.naturalHeight,"clip-path":`url(#${id})`});
          svg.append(defs,subject);
          anchor.setAttribute("aria-label", image.alt);
          anchor.append(svg);
          media.style.setProperty("--cutout-base",art.fill);
          media.style.setProperty("--cutout-accent",art.accent);
          media.classList.add("has-cutout");
          image.hidden = true;
        };
        if (image.complete) create();
        else image.addEventListener("load",create,{once:true});
      }
    }
  }
  for (const container of containers) new MutationObserver(decorate).observe(container,{childList:true,subtree:true});
  decorate();
})();
