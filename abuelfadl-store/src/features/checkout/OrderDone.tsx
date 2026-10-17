"use client";

import { useEffect, useRef, useState } from "react";
import { BasketBack, BasketFront } from "@/components/checkout/CheckoutBasket";
import { useCatalog } from "@/features/catalog/CatalogProvider";
import { formatMoney } from "@/lib/format";
import type { Order } from "@/types/order";

const MAX_TILES = 5;
const TILE_OFFSETS = [-22, 2, 26, -6, 14];
const TILE_TOP = 116;
const TILE_STEP_MS = 240;
const TILE_DURATION_MS = 520;

/**
 * "Order received" screen (v29 `#done` + `runDone`): product photos drop into the basket one by one, the basket
 * slides away, then the check mark, the order number and a short summary appear.
 */
export function OrderDone({ order, onContinue }: { order: Order | null; onContinue: () => void }) {
  const { getProduct } = useCatalog();
  const [phase, setPhase] = useState<"stage" | "message">("stage");
  const stageRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tiles = order ? order.items.slice(0, MAX_TILES).map((item) => getProduct(item.productId)) : [];
  const tileCount = tiles.length;

  // Basket animation (skipped, going straight to the message, when the visitor prefers reduced motion).
  useEffect(() => {
    if (!order) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("message");
      return;
    }
    setPhase("stage");
    const animations: Animation[] = [];
    tilesRef.current?.querySelectorAll<HTMLElement>(".dtile").forEach((tile, i) => {
      animations.push(
        tile.animate(
          [
            { transform: `translateY(-210px) scale(.7) rotate(${-12 + i * 7}deg)`, opacity: 0 },
            { opacity: 1, offset: 0.25 },
            { transform: `translateY(0) scale(1) rotate(${i % 2 ? 6 : -6}deg)`, opacity: 1 },
          ],
          { duration: TILE_DURATION_MS, delay: 300 + i * TILE_STEP_MS, easing: "cubic-bezier(.3,.1,.4,1)", fill: "both" },
        ),
      );
    });
    const landing = 300 + (Math.max(tileCount, 1) - 1) * TILE_STEP_MS + TILE_DURATION_MS;
    const bump = [{ transform: "translateY(0)" }, { transform: "translateY(5px)", offset: 0.5 }, { transform: "translateY(0)" }];
    // both halves of the basket (the part behind the tiles and the front) bump together
    stageRef.current?.querySelectorAll<HTMLElement>(".bsk-back, .cart3").forEach((basket) => {
      animations.push(basket.animate(bump, { duration: 260, delay: landing - 80 }));
    });
    const leave = stageRef.current?.animate(
      [
        { transform: "translateX(0) rotate(0)", opacity: 1 },
        { transform: "translateX(-14px) rotate(-2deg)", opacity: 1, offset: 0.2 },
        { transform: "translateX(300px) rotate(2deg)", opacity: 0 },
      ],
      { duration: 700, delay: landing + 260, easing: "cubic-bezier(.6,0,.9,.6)", fill: "forwards" },
    );
    if (leave) {
      animations.push(leave);
      leave.onfinish = () => setPhase("message");
    }
    return () => animations.forEach((animation) => animation.cancel());
  }, [order, tileCount]);

  // Message reveal: fade up, draw the check mark, small pop.
  useEffect(() => {
    if (!order || phase !== "message") return;
    const message = messageRef.current;
    if (!message) return;
    const animations: Animation[] = [];
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animations.push(
        message.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 450, easing: "ease-out", fill: "forwards" }),
      );
      const tickPath = message.querySelector<SVGPathElement>(".tick path");
      const tick = message.querySelector<HTMLElement>(".tick");
      if (tickPath) {
        animations.push(
          tickPath.animate([{ strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDasharray: 1, strokeDashoffset: 0 }], { duration: 600, delay: 150, easing: "ease-out", fill: "backwards" }),
        );
      }
      if (tick) animations.push(tick.animate([{ scale: 0.6 }, { scale: 1.08, offset: 0.6 }, { scale: 1 }], { duration: 550, easing: "ease-out" }));
    }
    message.style.opacity = "1";
    const timer = setTimeout(() => buttonRef.current?.focus({ preventScroll: true }), 300);
    return () => {
      clearTimeout(timer);
      animations.forEach((animation) => animation.cancel());
    };
  }, [order, phase]);

  const shown = order !== null;

  return (
    <div className={shown ? "done on" : "done"} id="done" role="dialog" aria-modal="true" aria-labelledby="doneTitle" hidden={!shown} inert={!shown}>
      <div className="done-in">
        {shown && phase === "stage" && (
          <div className="stage2" id="stage2" ref={stageRef} aria-hidden="true">
            <BasketBack id="bskb" />
            <div id="drops" ref={tilesRef}>
              {tiles.map((product, index) => (
                <div key={product?.id ?? index} className="dtile" style={{ left: 86 - 23 + TILE_OFFSETS[index], top: TILE_TOP }}>
                  {product?.imageUrl ? <img alt="" src={product.imageUrl} /> : <span className="phl" aria-hidden="true" />}
                </div>
              ))}
            </div>
            <BasketFront id="cart3" />
          </div>
        )}
        <div className={phase === "message" ? "dmsg show" : "dmsg"} id="dmsg" ref={messageRef} style={phase === "message" ? undefined : { opacity: 0 }}>
          <div className="tick" aria-hidden="true">
            <svg viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="3" />
              <path pathLength="1" d="M15 27l8 8 14-16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 id="doneTitle">تم استلام طلبك</h2>
          {order && (
            <>
              <p className="onum">
                رقم طلبك <b dir="ltr">{order.number}</b>
              </p>
              <div className="osum" id="osum">
                <div>
                  <span>الاسم</span>
                  <b>{order.customer.name}</b>
                </div>
                <div>
                  <span>العنوان</span>
                  <b>{order.customer.address}</b>
                </div>
                <div>
                  <span>الدفع</span>
                  <b>كاش عند الاستلام</b>
                </div>
                <div>
                  <span>الإجمالي</span>
                  <b>{formatMoney(order.total)} ج.م</b>
                </div>
              </div>
              <p className="onote">هنتواصل معك على {order.customer.phone} لتأكيد الطلب. (نسخة تجريبية: الطلب لا يُرسل فعليًا بعد.)</p>
            </>
          )}
          <button className="btn btn-primary" type="button" id="doneBtn" ref={buttonRef} onClick={onContinue}>
            متابعة التسوق
          </button>
        </div>
      </div>
    </div>
  );
}
