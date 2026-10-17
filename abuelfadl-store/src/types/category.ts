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
}
