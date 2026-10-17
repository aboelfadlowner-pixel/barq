/**
 * Small visual effects of adding to the cart, ported from v29 (`bump` and `fly`):
 * the count badges pop, and a ghost copy of the product photo flies to the cart button.
 * They only touch the DOM from click handlers (never during render).
 */

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function bumpBadges() {
  document.querySelectorAll<HTMLElement>(".cc").forEach((badge) => {
    badge.classList.remove("bump");
    void badge.offsetWidth; // restart the CSS animation
    badge.classList.add("bump");
  });
}

/** Where the flying photo lands: the bottom-nav cart button on phones, the header cart button otherwise. */
function cartTarget(): HTMLElement | null {
  const header = document.getElementById("cartBtn");
  if (window.innerWidth < 900) return document.querySelector<HTMLElement>('.bnav [data-nav="cart"]') ?? header;
  return header;
}

export function flyToCart(from: HTMLElement | null) {
  const target = cartTarget();
  if (!target) return;
  const finish = () => {
    bumpBadges();
    target.classList.remove("pulse2");
    void target.offsetWidth;
    target.classList.add("pulse2");
  };
  if (!from || prefersReducedMotion()) return finish();

  const host = from.closest(".p") ?? from.closest("#pd");
  const source = host?.querySelector<HTMLElement>(".pi img, .sh-img img, .pi>.art, .sh-img>.art");
  const a = (source ?? from).getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const size = Math.min(96, Math.max(56, Math.min(a.width, a.height)));

  let ghost: HTMLElement;
  if (source instanceof HTMLImageElement) {
    const image = document.createElement("img");
    image.src = source.src;
    image.alt = "";
    ghost = image;
  } else if (source) {
    ghost = document.createElement("span");
    const clone = source.cloneNode(true) as HTMLElement;
    clone.removeAttribute("class");
    clone.setAttribute("style", "display:block;width:100%;height:100%");
    ghost.appendChild(clone);
  } else {
    ghost = document.createElement("span");
    ghost.style.background = "var(--brand-hi)";
  }
  ghost.setAttribute("class", "flyimg");
  ghost.setAttribute("aria-hidden", "true");
  const startX = a.left + a.width / 2 - size / 2;
  const startY = a.top + a.height / 2 - size / 2;
  ghost.style.cssText += `;left:${startX}px;top:${startY}px;width:${size}px;height:${size}px`;
  document.body.appendChild(ghost);

  const dx = b.left + b.width / 2 - (startX + size / 2);
  const dy = b.top + b.height / 2 - (startY + size / 2);
  const animation = ghost.animate(
    [
      { transform: "translate(0,0) scale(1) rotate(0)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px,${Math.min(dy, 0) - 90}px) scale(.62) rotate(-8deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px,${dy}px) scale(.12) rotate(-14deg)`, opacity: 0.35 },
    ],
    { duration: 620, easing: "cubic-bezier(.5,.05,.3,1)" },
  );
  animation.onfinish = () => {
    ghost.remove();
    finish();
  };
}
