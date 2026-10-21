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
  /** Category card photo on the home page ("تسوّق حسب القسم"), portrait 4:5, e.g. "/covers/juice/tile.webp". */
  imageUrl?: string;
  /**
   * Small round picture shown in place of the icon (category switcher, category page pill), square.
   * Falls back to `imageUrl`, then to the illustration `art`.
   */
  iconUrl?: string;
  /** Short line under the category name on its page, e.g. "Fresh Dairy, Every Day" (dashboard «جملة القسم»). */
  tagline?: string;
  /** Notice shown at the top of the category page, e.g. «للعرض فقط» (dashboard «تنبيه القسم»). */
  notice?: string;
  /** Products of this category are shown but cannot be added to the cart or ordered from the site. */
  displayOnly?: boolean;
}
