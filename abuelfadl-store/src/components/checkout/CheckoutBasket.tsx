const TAN = "#3F7D57";

/** Back half of the basket: the handle and the dark inside of the opening. Drawn behind the falling product tiles. */
export function BasketBack({ id }: { id?: string }) {
  return (
    <div className="bsk-back" id={id} aria-hidden="true">
      <svg viewBox="0 0 150 150">
        <ellipse cx="75" cy="73" rx="58" ry="6" fill="#1F5E37" opacity=".55" />
        <path d="M26 72C26 8 124 8 124 72" fill="none" stroke={TAN} strokeWidth="6.5" strokeLinecap="round" />
        <path d="M26 72C26 8 124 8 124 72" fill="none" stroke="#A9CDB4" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Front half of the basket (woven sage-green body, rim) with the Abu El-Fadl logo on a white badge. Drawn in front of the tiles. */
export function BasketFront({ id }: { id?: string }) {
  return (
    <div className="cart3" id={id} aria-hidden="true">
      <svg className="bsk" viewBox="0 0 150 150">
        <defs>
          <linearGradient id="bskWicker" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E9F3EC" />
            <stop offset="1" stopColor="#B5D1BE" />
          </linearGradient>
          <clipPath id="bskBody">
            <path d="M20 74h110l-12 62q-1 6-7 6H39q-6 0-7-6z" />
          </clipPath>
        </defs>
        <path d="M20 74h110l-12 62q-1 6-7 6H39q-6 0-7-6z" fill="url(#bskWicker)" stroke={TAN} strokeWidth="2.5" strokeLinejoin="round" />
        <g clipPath="url(#bskBody)" stroke="#6FA183" strokeWidth="1.6" opacity=".5" fill="none">
          <path d="M20 92h110M24 110h102M28 128h94" />
          {[38, 54, 70, 86, 102, 118].map((x) => (
            <path key={x} d={`M${x} 76L${75 + (x - 75) * 0.8} 142`} />
          ))}
        </g>
        <rect x="14" y="68" width="122" height="11" rx="5.5" fill="#DCEBDF" stroke={TAN} strokeWidth="2.5" />
        <circle cx="75" cy="108" r="24" fill="#fff" stroke={TAN} strokeWidth="2" />
      </svg>
      <span className="clogo" role="img" aria-label="شعار أبو الفضل" />
    </div>
  );
}
