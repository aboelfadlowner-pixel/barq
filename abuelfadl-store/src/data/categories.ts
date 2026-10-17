import type { Category } from "../types/category";

/**
 * Product categories, copied unchanged from v29 (`CATS`), same order.
 * `art` is the id of the SVG sprite symbol used for the category icon; `tint` is the card background colour.
 * Temporary static data: replace by a real source behind `src/services` later.
 */
export const categories: Category[] = [
  { id: "dairy", name: "ألبان", art: "a-milk", tint: "#EEF5FC" },
  { id: "cheese", name: "أجبان", art: "a-cheese", tint: "#FFF7DC" },
  { id: "imported", name: "أجبان مستوردة", art: "a-wheel", tint: "#FFF7DC" },
  { id: "kiri", name: "كيريهات وابتكارات", art: "a-kiri", tint: "#EAF1FB" },
  { id: "bakery", name: "مخبوزات", art: "a-bread", tint: "#FFF6EA" },
  { id: "fresh", name: "مخبوزات فريش", art: "a-bread", tint: "#FFF1DF" },
  { id: "produce", name: "فاكهة وخضروات", art: "a-apple", tint: "#FDEEEE" },
  { id: "meat", name: "لحوم", art: "a-meat", tint: "#FCEDEA" },
  { id: "fish", name: "فسيخ ورنجة", art: "a-fish", tint: "#EAF3FA" },
  { id: "deli", name: "مخللات ومقبلات", art: "a-jar", tint: "#EBF6EE" },
  { id: "drinks", name: "عصائر وآيس كريم وقهوة", art: "a-juice", tint: "#FFF2DF" },
  { id: "juice", name: "عصائر فريش", art: "a-juice", tint: "#FFF2DF" },
  { id: "sandwich", name: "ساندويتشات وسلطات", art: "a-bowl", tint: "#EEF6EC" },
  { id: "eggs", name: "بيض", art: "a-egg", tint: "#FFF4E5" },
  { id: "syrian", name: "منتجات سورية", art: "a-olive", tint: "#EFF4E4" },
  { id: "nature", name: "خيرات الطبيعة", art: "a-honey", tint: "#FFF3D6" },
  { id: "offers", name: "العروض", art: "a-bowl", tint: "#FDEEEE" },
];
