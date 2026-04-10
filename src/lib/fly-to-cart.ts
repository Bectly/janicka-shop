/**
 * Fly-to-cart animation — creates a ghost image that arcs from the source
 * element to the cart icon in the header. Respects prefers-reduced-motion.
 */
export function flyToCart(imageSrc: string, sourceEl: HTMLElement) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const cartEl = document.querySelector<HTMLElement>("[data-cart-button]");
  if (!cartEl) return;

  const startRect = sourceEl.getBoundingClientRect();
  const endRect = cartEl.getBoundingClientRect();

  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;
  const endX = endRect.left + endRect.width / 2;
  const endY = endRect.top + endRect.height / 2;

  const dx = endX - startX;
  const dy = endY - startY;

  // Create flying ghost thumbnail
  const ghost = document.createElement("img");
  ghost.src = imageSrc;
  ghost.alt = "";
  ghost.style.cssText = `
    position: fixed;
    z-index: 9999;
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: 14px;
    pointer-events: none;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    left: ${startX - 28}px;
    top: ${startY - 28}px;
    will-change: transform, opacity;
  `;

  document.body.appendChild(ghost);

  // Animate along an arc trajectory (slight upward curve)
  const anim = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      {
        transform: `translate(${dx * 0.5}px, ${Math.min(dy * 0.3, -40)}px) scale(0.55)`,
        opacity: 0.85,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(0.12)`,
        opacity: 0,
      },
    ],
    {
      duration: 620,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "forwards",
    }
  );

  anim.onfinish = () => ghost.remove();
  anim.oncancel = () => ghost.remove();
}
