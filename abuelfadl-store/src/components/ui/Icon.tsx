/** Line icon from the SVG sprite rendered in the root layout (`IconSprite`). `id` is a symbol id such as "i-search". */
export function Icon({ id }: { id: string }) {
  return (
    <svg className="ico" aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}
