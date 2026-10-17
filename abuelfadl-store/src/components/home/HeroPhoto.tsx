"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { REDUCE_MOTION } from "@/lib/motion";

const TEAM_PHOTO = "/images/team.jpg";

/**
 * The team photo of the home hero (v29 `#heroPhoto`, js/11-hero-team-photo.js).
 * 1. Two halves of the photo fly in from both sides once the photo is decoded and on screen (class `in`).
 * 2. 1.5 s later it becomes `live`: it follows the pointer (or the phone's tilt) with a small 3D rotation and a glare.
 * 3. Clicking the photo plays the entrance again.
 * The classes and CSS variables are set on the element directly (not through React state) so pointer movement
 * never re-renders anything.
 */
export function HeroPhoto({ delayMs = 0 }: { delayMs?: number }) {
  const photoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const photo = photoRef.current;
    const wrap = photo?.parentElement;
    if (!photo || !wrap) return;

    let rx = 0, ry = 0, tx = 0, ty = 0, gx = 50, gy = 50;
    let frame = 0;
    let live = false;
    let played = false;
    let playTimer: ReturnType<typeof setTimeout> | undefined;
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let imageReady = false;
    let onScreen = false;
    let disposed = false;

    const draw = () => {
      rx += (tx - rx) * 0.1;
      ry += (ty - ry) * 0.1;
      photo.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      photo.style.setProperty("--gx", `${gx}%`);
      photo.style.setProperty("--gy", `${gy}%`);
      photo.style.setProperty("--sx", `${(-ry * 2.2).toFixed(1)}px`);
      photo.style.setProperty("--sy", `${(rx * 2.2 + 22).toFixed(1)}px`);
      frame = Math.abs(tx - rx) > 0.02 || Math.abs(ty - ry) > 0.02 ? requestAnimationFrame(draw) : 0;
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    /** nx, ny in -1..1 across the photo area. */
    const aim = (nx: number, ny: number) => {
      if (!live) return;
      ty = nx * 7;
      tx = -ny * 4.5;
      gx = 50 + nx * 40;
      gy = 50 + ny * 40;
      kick();
    };

    const play = () => {
      clearTimeout(playTimer);
      live = false;
      tx = ty = rx = ry = 0;
      photo.style.transform = "";
      photo.classList.remove("in", "live");
      void photo.offsetWidth; // restart the CSS transition
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (disposed) return;
          photo.classList.add("in");
          playTimer = setTimeout(() => {
            live = true;
            photo.classList.add("live");
          }, REDUCE_MOTION ? 1100 : 1500);
        }),
      );
    };
    const start = () => {
      if (played || disposed) return;
      played = true;
      play();
    };
    const tryStart = () => {
      if (imageReady && onScreen) start();
    };

    // Start only when the photo is decoded and at least a quarter of it is visible (v29), or after 3.5 s anyway.
    const image = new Image();
    const markReady = () => {
      const decoded = image.decode ? image.decode() : Promise.resolve();
      decoded.catch(() => undefined).then(() => {
        imageReady = true;
        tryStart();
      });
    };
    image.onload = markReady;
    image.onerror = markReady;
    image.src = TEAM_PHOTO;

    let observer: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries, self) => {
          if (entries[0].isIntersecting) {
            onScreen = true;
            self.disconnect();
            startTimer = setTimeout(tryStart, 150);
          }
        },
        { threshold: 0.25 },
      );
      observer.observe(photo);
    } else {
      onScreen = true;
    }
    fallbackTimer = setTimeout(() => {
      imageReady = true;
      onScreen = true;
      start();
    }, 3500);

    const onClick = () => {
      if (played) play();
    };
    photo.addEventListener("click", onClick);

    const onPointerMove = (event: PointerEvent) => {
      const box = wrap.getBoundingClientRect();
      aim(((event.clientX - box.left) / box.width - 0.5) * 2, ((event.clientY - box.top) / box.height - 0.5) * 2);
    };
    const onPointerLeave = () => aim(0, 0);
    // On touch screens the photo settles back to flat shortly after the finger lifts.
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") setTimeout(() => aim(0, 0), 900);
    };
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma == null) return;
      aim(Math.max(-1, Math.min(1, event.gamma / 20)), Math.max(-1, Math.min(1, ((event.beta ?? 45) - 45) / 20)));
    };
    // iOS asks for permission to read the phone's tilt; it is requested on the first tap on the hero.
    type OrientationEvent = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
    const orientation = window.DeviceOrientationEvent as OrientationEvent | undefined;
    const askPermission = () => {
      orientation
        ?.requestPermission?.()
        .then((state) => {
          if (state === "granted") window.addEventListener("deviceorientation", onOrientation);
        })
        .catch(() => undefined);
    };

    if (!REDUCE_MOTION) {
      wrap.addEventListener("pointermove", onPointerMove);
      wrap.addEventListener("pointerleave", onPointerLeave);
      wrap.addEventListener("pointerup", onPointerUp);
      if (orientation && typeof orientation.requestPermission !== "function") window.addEventListener("deviceorientation", onOrientation);
      else if (orientation) wrap.addEventListener("click", askPermission, { once: true });
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(playTimer);
      clearTimeout(startTimer);
      clearTimeout(fallbackTimer);
      observer?.disconnect();
      photo.removeEventListener("click", onClick);
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerleave", onPointerLeave);
      wrap.removeEventListener("pointerup", onPointerUp);
      wrap.removeEventListener("click", askPermission);
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, []);

  return (
    <div className="tm-wrap seq" style={{ "--d": delayMs } as CSSProperties}>
      <div className="tm" id="heroPhoto" ref={photoRef} role="img" aria-label="فريق أبو الفضل وسط أجبان المتجر">
        <div className="tm-half l" />
        <div className="tm-half r" />
        <i className="tm-glare" />
      </div>
    </div>
  );
}
