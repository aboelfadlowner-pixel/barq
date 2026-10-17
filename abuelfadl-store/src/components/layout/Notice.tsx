import { MIN_ORDER } from "@/lib/constants";

/** Delivery notice strip above the header. */
export function Notice() {
  return (
    <div className="notice">
      <div className="wrap">
        <span className="pulse" aria-hidden="true" />
        <span>التوصيل متاح حاليًا داخل البيطاش فقط، والحد الأدنى للطلب {MIN_ORDER} جنيه</span>
      </div>
    </div>
  );
}
