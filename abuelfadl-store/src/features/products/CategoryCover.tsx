import type { CSSProperties } from "react";

/**
 * Animated cover for a category banner. Only the categories listed in `COVERS` have one;
 * every other category keeps the "مكان صورة القسم" placeholder.
 *
 * "sandwich" cover: the two sandwiches are assembled layer by layer (each photo is cut into horizontal
 * slices; every slice falls on its own, bottom layer first), then the two salad trays drop in at the sides.
 * The photos are cut-outs of the store's product photos (public/covers/sandwich/*.webp).
 */

type Vars = CSSProperties & Record<`--${string}`, string | number>;

interface Piece {
  file: string;
  /** width / height of the cut-out photo */
  ratio: number;
  /** height relative to the scene height, mobile / desktop */
  k: number;
  kd: number;
  /** delay of the first layer, seconds */
  delay: number;
}

// Each sandwich photo (three stacked sandwiches on a board) is cut into horizontal slices (top % → bottom %).
// Every slice falls on its own, bottom layer first, until the sandwich is put together.
const SLICES: Array<[number, number]> = [
  [0, 34],
  [34, 62],
  [62, 84],
  [84, 100],
];
const SLICE_STEP = 0.3; // seconds between two layers of the same sandwich

// Left to right on screen (the scene row is forced to ltr).
const TURKEY: Piece = { file: "turkey", ratio: 284 / 265, k: 0.74, kd: 0.9, delay: 0.1 };
const BEEF: Piece = { file: "beef", ratio: 282 / 274, k: 0.74, kd: 0.9, delay: 0.8 };
const DELI: Piece = { file: "deli", ratio: 421 / 270, k: 0.27, kd: 0.36, delay: 2.3 };
const CHICKEN: Piece = { file: "chicken", ratio: 400 / 259, k: 0.27, kd: 0.36, delay: 2.6 };

const src = (file: string) => `/covers/sandwich/${file}.webp`;
const sizeVars = (p: Piece) => ({ "--k": p.k, "--kd": p.kd, "--ar": p.ratio }) as Vars;

function Sandwich({ piece }: { piece: Piece }) {
  return (
    <div className="cv-sw" style={sizeVars(piece)} aria-hidden="true">
      <i className="cv-sh" style={{ "--d": `${piece.delay + SLICE_STEP * (SLICES.length - 1) + 0.6}s` } as Vars} />
      {SLICES.map(([top, bottom], i) => {
        // Each layer is a box showing one horizontal band of the photo (overflow hidden, no clip-path: clip-path on an
        // animated image painted pale rectangles in Chrome). 0.5% overlap between neighbours hides hairlines after landing.
        const from = Math.max(top - 0.5, 0);
        const height = bottom - from;
        return (
          <span
            key={top}
            className="cv-sl"
            style={
              {
                "--t": `${from}%`,
                "--h": `${height}%`,
                "--d": `${piece.delay + SLICE_STEP * (SLICES.length - 1 - i)}s`,
              } as Vars
            }
          >
            <img src={src(piece.file)} alt="" decoding="async" style={{ top: `${(-from / height) * 100}%`, height: `${10000 / height}%` }} />
          </span>
        );
      })}
    </div>
  );
}

function Salad({ piece }: { piece: Piece }) {
  return (
    <div className="cv-sd" style={sizeVars(piece)} aria-hidden="true">
      <i className="cv-sh" style={{ "--d": `${piece.delay + 0.7}s` } as Vars} />
      <img src={src(piece.file)} alt="" decoding="async" style={{ "--d": `${piece.delay}s` } as Vars} />
    </div>
  );
}

function SandwichCover() {
  return (
    <div className="cv" role="img" aria-label="ساندويتشات وسلطات أبو الفضل">
      <Salad piece={DELI} />
      <Sandwich piece={TURKEY} />
      <Sandwich piece={BEEF} />
      <Salad piece={CHICKEN} />
    </div>
  );
}

/**
 * "juice" cover (fresh juices): the lying orange bottle slides in from the left first, then the mango, roselle,
 * chocolate-milk and sobia bottles drop in one after another and stand side by side behind it (the layout follows the
 * store's group photo). Positions are percentages of a square scene, see the `.cvj` rules in 24-category-covers.css.
 */
const JUICE_BOTTLES = ["mango", "rose", "choc", "sobia"] as const;

function JuiceCover() {
  return (
    <div className="cvj" role="img" aria-label="عصائر فريش أبو الفضل: مانجو وكركديه وشوكولاتة وسوبيا وبرتقال">
      <div className="cvj-s" aria-hidden="true">
        <i className="cvj-gs" />
        <img className="cvj-o" src="/covers/juice/orange.webp" alt="" decoding="async" />
        {JUICE_BOTTLES.map((name) => (
          <img key={name} className={`cvj-b cvj-${name}`} src={`/covers/juice/${name}.webp`} alt="" decoding="async" />
        ))}
      </div>
    </div>
  );
}

/**
 * "dairy" cover: cow ghee, milk and buffalo ghee at the back, murta and cream in front (public/covers/dairy/*.webp),
 * grouped tightly, each with a contact shadow; they rise into place one after another.
 * Positions are percentages of the scene, see the `.cvd` rules in 24-category-covers.css.
 */
const DAIRY_PIECES = ["milk", "ghee-cow", "ghee-buffalo", "murta", "cream"] as const;

function DairyCover() {
  return (
    <div className="cvd" role="img" aria-label="ألبان أبو الفضل: سمن بقري وحليب وسمن جاموسي ومورتة وقشطة">
      <div className="cvd-s" aria-hidden="true">
        {DAIRY_PIECES.map((name) => (
          <span key={name} className={`cvd-p cvd-${name}`}>
            <i className="sh" />
            <img src={`/covers/dairy/${name}.webp`} alt="" decoding="async" />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * "cheese" cover: four cheeses on wooden plates (public/covers/cheese/*.webp) — the pepper and white blocks at the back,
 * shredded cheddar and mozzarella in front — each with a contact shadow; they rise in like the dairy cover.
 * Same scene and animation as `.cvd`; positions are the `.cvch-*` rules in 24-category-covers.css.
 */
const CHEESE_PIECES = ["feta-pepper", "white-block", "cheddar-shred", "mozz-shred"] as const;

function CheeseCover() {
  return (
    <div className="cvd" role="img" aria-label="أجبان: جبنة بالفلفل وجبنة بيضاء وشيدر وموتزاريلا مبشورة على أطباق خشب">
      <div className="cvd-s" aria-hidden="true">
        {CHEESE_PIECES.map((name) => (
          <span key={name} className={`cvd-p cvch-${name}`}>
            <i className="sh" />
            <img src={`/covers/cheese/${name}.webp`} alt="" decoding="async" />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * "kiri" cover (spreads and creations): four Abu El Fadl spread tubs (public/covers/kiri/*.webp), two at the back and two
 * in front, each with a contact shadow; they rise in like the dairy cover. Positions are the `.cvk-*` rules.
 */
const KIRI_PIECES = ["tub-tl", "tub-tr", "tub-bl", "tub-br"] as const;

function KiriCover() {
  return (
    <div className="cvd" role="img" aria-label="كيريهات وابتكارات: أربع علب سبريد أبو الفضل">
      <div className="cvd-s" aria-hidden="true">
        {KIRI_PIECES.map((name) => (
          <span key={name} className={`cvd-p cvk-${name}`}>
            <i className="sh" />
            <img src={`/covers/kiri/${name}.webp`} alt="" decoding="async" />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * "deli" cover (pickles and starters): four Abu El Fadl tubs — sliced and kalamata olives at the back, mixed pickles and
 * stuffed lemons in front — as one piece (public/covers/deli/group.webp), since they overlap in the photo.
 * It rises in with a contact shadow like the dairy cover; position is the `.cvdl-group` rule.
 */
function DeliCover() {
  return (
    <div className="cvd" role="img" aria-label="مخللات ومقبلات: زيتون شرائح وزيتون كالاماتا ومخلل مشكل وليمون معصفر">
      <div className="cvd-s" aria-hidden="true">
        <span className="cvd-p cvdl-group">
          <i className="sh" />
          <img src="/covers/deli/group.webp" alt="" decoding="async" />
        </span>
      </div>
    </div>
  );
}

/**
 * "syrian" cover (Syrian products): four tubs of Abu El Fadl labneh balls (public/covers/syrian/*.webp) — zaatar and
 * makdous at the back, black seed and pistachio in front — each with a contact shadow, rising in like the kiri cover.
 * Positions are the `.cvsy-*` rules.
 */
const SYRIAN_PIECES = ["zaatar", "makdous", "blackseed", "pistachio"] as const;

function SyrianCover() {
  return (
    <div className="cvd" role="img" aria-label="منتجات سورية: كرات لبنة شامية بالزعتر والمكدوس وحبة البركة والفستق">
      <div className="cvd-s" aria-hidden="true">
        {SYRIAN_PIECES.map((name) => (
          <span key={name} className={`cvd-p cvsy-${name}`}>
            <i className="sh" />
            <img src={`/covers/syrian/${name}.webp`} alt="" decoding="async" />
          </span>
        ))}
      </div>
    </div>
  );
}

const COVERS: Record<string, () => React.JSX.Element> = {
  sandwich: SandwichCover,
  juice: JuiceCover,
  dairy: DairyCover,
  cheese: CheeseCover,
  kiri: KiriCover,
  deli: DeliCover,
  syrian: SyrianCover,
};

/** The animated cover of a category, or null when the category has none. */
export function getCategoryCover(slug: string): React.JSX.Element | null {
  const Cover = COVERS[slug];
  return Cover ? <Cover /> : null;
}
