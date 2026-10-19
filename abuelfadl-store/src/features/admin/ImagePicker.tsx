"use client";

import { useRef, useState } from "react";
import { uploadImage } from "./api";

/**
 * Draws the picked photo on a canvas no larger than `max` px on its long side and saves it as WebP (JPEG where the
 * browser cannot make WebP), so a 5 MB phone photo becomes ~100 KB and the store stays fast.
 */
async function shrink(file: File, max: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("هذا الملف ليس صورة أو غير مدعوم"));
      img.src = url;
    });
    const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
    const webp = await encode("image/webp");
    if (webp && webp.type === "image/webp") return webp;
    // JPEG has no transparency: paint a white background first.
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const jpeg = await encode("image/jpeg");
    if (!jpeg) throw new Error("تعذّرت معالجة الصورة، جرّب صورة أخرى");
    return jpeg;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Photo field for the dashboard: pick from the phone / computer (or drop a file), it is resized and uploaded, and the
 * new URL is passed to `onChange`. A link can still be pasted under «أو حط لينك».
 */
export function ImagePicker({
  value,
  onChange,
  max = 1000,
  shape = "square",
  compact = false,
}: {
  value: string;
  onChange: (url: string) => void;
  /** Long side in px after resizing. */
  max?: number;
  /** Preview frame: "square" (products, icons) or "tall" (4:5 category cards). */
  shape?: "square" | "tall";
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("اختر ملف صورة (JPG أو PNG أو WebP)");
    setBusy(true);
    setError("");
    try {
      onChange(await uploadImage(await shrink(file, max)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className={`img-pick ${shape}${compact ? " compact" : ""}`}>
      <button
        type="button"
        className={`img-drop${dragging ? " over" : ""}${value ? " has" : ""}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void pick(e.dataTransfer.files[0]);
        }}
        disabled={busy}
        aria-label={value ? "تغيير الصورة" : "اختيار صورة"}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" />
        ) : (
          <span className="img-empty">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            {compact ? "ارفع صورة" : "اضغط لاختيار صورة، أو اسحبها وأفلتها هنا"}
          </span>
        )}
        {busy ? <span className="img-busy">جارٍ رفع الصورة…</span> : null}
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
      <div className="img-actions">
        <button className="btn btn-sm" type="button" disabled={busy} onClick={() => input.current?.click()}>
          {value ? "تغيير الصورة" : "اختر صورة"}
        </button>
        {value ? (
          <button className="btn btn-sm btn-ghost" type="button" disabled={busy} onClick={() => onChange("")}>
            إزالة الصورة
          </button>
        ) : null}
        <button className="btn btn-sm btn-ghost" type="button" onClick={() => setShowLink((v) => !v)}>
          {showLink ? "إخفاء الرابط" : "أو أضف رابطًا"}
        </button>
      </div>
      {showLink ? (
        <input
          className="input num"
          dir="ltr"
          placeholder="https://… أو /products/…"
          value={value.startsWith("data:") ? "" : value}
          onChange={(e) => onChange(e.target.value.trim())}
          aria-label="رابط الصورة"
        />
      ) : null}
      {error ? <small className="err">{error}</small> : <small className="hint">{compact ? "" : "يمكن رفع JPG أو PNG من الموبايل، ويتم تصغير الصورة وضبطها تلقائيًا"}</small>}
    </div>
  );
}
