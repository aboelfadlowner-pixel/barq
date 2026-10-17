/** Illustration from the SVG sprite (`IllustrationSprite`), e.g. id "a-milk". */
export function Art({ id, viewBox }: { id: string; viewBox?: string }) {
  return (
    <svg className="art" viewBox={viewBox} aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}
