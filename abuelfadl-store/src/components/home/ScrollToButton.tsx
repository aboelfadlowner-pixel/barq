"use client";

/** Button that smooth-scrolls to an element on the same page (v29 `data-scroll`). */
export function ScrollToButton({ targetId, className, children }: { targetId: string; className?: string; children: React.ReactNode }) {
  const onClick = () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <button className={className} type="button" onClick={onClick}>
      {children}
    </button>
  );
}
