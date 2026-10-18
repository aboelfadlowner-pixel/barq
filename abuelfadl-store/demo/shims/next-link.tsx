import { forwardRef } from "react";
import { navigate } from "./next-navigation";

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; prefetch?: boolean; scroll?: boolean };

/** `next/link` for the demo build: a plain anchor that navigates the in-memory router. */
const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, prefetch: _p, scroll: _s, onClick, ...rest }, ref) {
  return (
    <a
      {...rest}
      ref={ref}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        navigate(href);
      }}
    />
  );
});

export default Link;
