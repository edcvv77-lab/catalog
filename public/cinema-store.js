(() => {
  const root = document.documentElement;
  const film = document.querySelector(".store-film");
  const stage = document.querySelector(".film-stage");
  const header = document.querySelector(".simple-header");
  const panels = [...document.querySelectorAll(".film-copy")];
  const track = document.querySelector(".film-track");
  const buttons = [...track.querySelectorAll("button")];
  const status = track.querySelector(".film-status");
  const compact = matchMedia("(max-width:650px)");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const short = matchMedia("(max-height:520px) and (max-width:850px)");
  const names = ["عناية يومية", "العناية بالشعر", "العناية بالبشرة"];
  const clamp = n => Math.max(0, Math.min(1, n));
  const ease = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
  const distance = () => Math.max(1, film.offsetHeight - stage.offsetHeight);
  let current = -1;
  let frame = 0;
  let animated = false;

  function render() {
    frame = 0;
    if (!animated) return;
    const p = clamp((header.offsetHeight - film.getBoundingClientRect().top) / distance());
    const hair = ease((p - .08) / .31);
    const skin = ease((p - .55) / .31);
    const motion = {
      hair, skin, progress:p, glow:.4 + .42 * Math.sin(Math.PI * (hair + skin) / 2),
      "art-x":`${compact.matches ? -5 * hair + 9 * skin : -23 * hair + 44 * skin}vw`,
      "art-y":`${compact.matches ? -10 * hair + 14 * skin : -8 * hair + 20 * skin}px`,
      "art-scale":1 + .22 * hair + .19 * skin,
      "alpha-arora":1 - .93 * skin,
      "alpha-herb":1 - .96 * skin,
      "alpha-soap":1 - .93 * hair * (1 - skin),
      "move-arora":`${21 * hair - 38 * skin}px`,
      "high-arora":`${-21 * hair - 14 * skin}px`,
      "move-herb":`${-59 * hair + 33 * skin}px`,
      "high-herb":`${-18 * hair - 17 * skin}px`,
      "move-soap":`${-28 * hair + 16 * skin}px`,
      "high-soap":`${9 * hair - 57 * skin}px`,
      "soap-scale":1 + .49 * skin,
      shade:compact.matches ? 1 : 1 - .52 * hair * (1 - skin) - .2 * skin
    };
    for (const [key,value] of Object.entries(motion)) stage.style.setProperty(`--${key}`, value);
    const weights = [
      1 - ease((p - .035) / .19),
      ease((p - .23) / .15) * (1 - ease((p - .57) / .17)),
      ease((p - .69) / .17)
    ];
    const selected = p >= .69 ? 2 : p >= .23 ? 1 : 0;
    panels.forEach((panel,index) => {
      panel.style.setProperty("--visible", weights[index]);
      panel.style.setProperty("--y", `${(1 - weights[index]) * (index > selected ? 30 : -30)}px`);
      if (selected !== current) {
        panel.inert = selected !== index;
        if (selected === index) buttons[index].setAttribute("aria-current", "step");
        else buttons[index].removeAttribute("aria-current");
      }
    });
    if (selected !== current) status.textContent = names[selected];
    current = selected;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(render); }
  function measure() {
    root.style.setProperty("--film-header", `${header.offsetHeight}px`);
    schedule();
  }
  function configure() {
    animated = !reduced.matches && !short.matches;
    root.classList.toggle("film-motion", animated);
    track.hidden = !animated;
    current = -1;
    if (!animated) {
      stage.removeAttribute("style");
      panels.forEach(panel => { panel.inert = false; panel.removeAttribute("style"); });
    }
    measure();
    render();
  }
  film.querySelectorAll("[data-stop]").forEach(link => {
    link.addEventListener("click", event => {
      if (!animated || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      scrollTo({ top: Math.max(0, scrollY + film.getBoundingClientRect().top - header.offsetHeight + distance() * Number(link.dataset.stop)), behavior:"smooth" });
    });
  });
  configure();
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(header);
  reduced.addEventListener("change", configure);
  short.addEventListener("change", configure);
  addEventListener("scroll", schedule, { passive:true });
  addEventListener("scrollend", render);
  addEventListener("resize", measure);
})();
