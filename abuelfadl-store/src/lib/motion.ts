/**
 * v29 deliberately keeps its entrance motion (hero photo, reveals, card tilt) even on devices that ask for reduced
 * motion: only endless loops are stopped (see the `prefers-reduced-motion` rule in the CSS). `reduce` is `false` in v29's
 * `00-core.js` with the comment "motion is intended in the design". This constant keeps that decision in one place.
 */
export const REDUCE_MOTION = false;
