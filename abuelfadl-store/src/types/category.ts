/** Category identifier. A plain string slug (e.g. "dairy"); it is also used in the `/category/[slug]` URL. */
export type CategoryId = string;

export interface Category {
  id: CategoryId;
  /** Arabic display name. */
  name: string;
  /** Id of the SVG sprite symbol used as the category icon (e.g. "a-milk"). */
  art: string;
  /** Card background colour (hex). */
  tint: string;
  /**
   * Category photo, e.g. "/covers/juice/tile.webp". Shown as the banner on the category page and, small and round,
   * in place of the icon (category switcher, home card). Missing: the icon `art` is shown instead.
   */
  imageUrl?: string;
}
