# أبو الفضل ستور — الواجهة الأمامية (Frontend)

## الشغل بيتم إزاي
```
python3 build.py        # بيطلع dist/abuelfadl.html (ملف واحد جاهز للنشر/المعاينة)
```
كل التعديلات بتتعمل في المجلدات تحت، وبعدين `build.py` بيجمعهم. **متعدلش ملف `dist/` بإيدك.**

## كل حاجة مكانها فين
| عايز تغيّر... | افتح |
|---|---|
| ألوان / مقاسات / الخط الأساسي | `css/01-tokens-base.css` (المتغيرات في أول الملف) |
| الأزرار والشريط العلوي | `css/02-buttons-notice.css` |
| الهيدر واللوجو | `css/03-header.css` + `css/21-wordmark.css` + `partials/header.html` |
| صورة الفريق (الهيرو) | `css/20-team-hero.css` + `js/11-hero-team-photo.js` + `assets/img/team.jpg` |
| كروت الأقسام في الرئيسية | `css/04-photo-cards.css` + `js/03-static-pieces.js` |
| كروت المنتجات (السعر، الاسم، زر +) | `css/06-product-cards.css` + `css/22-product-hover.css` + `js/04-product-cards.js` |
| صفحة القسم | `css/12-category-page.css` + `partials/category-page.html` + `js/05-...` |
| نافذة تفاصيل المنتج | `css/11-sheet-product.css` + `js/05-product-sheet-and-category-page.js` |
| السلة | `css/18-drawer-cart.css` + `js/09-cart.js` |
| إتمام الطلب وشاشة النجاح | `css/13-checkout.css` + `css/14-done.css` + `js/12-checkout.js` |
| الفوتر / شريط الموبايل السفلي | `css/16-footer.css`, `css/17-bottom-nav.css` + `partials/` |
| البحث | `js/07-search.js` |
| **الأقسام** (الأسماء/الألوان) | `js/data/categories.js` |
| **المنتجات** (الاسم، السعر، القسم، بالوزن، نفد) | `js/data/products.js` (منتج في كل سطر) |
| **صور المنتجات** | حطي الصورة في `assets/products/<رقم المنتج>.webp` (الرقم هو أول رقم في سطر المنتج) |
| الحد الأدنى للطلب (300) | `js/00-core.js` (`MIN_ORDER`) |

## الهيكل
```
index.html          القالب (بيستدعي partials)
partials/           أجزاء الـHTML (هيدر، رئيسية، فوتر، سلة...)
css/                أجزاء الـCSS مرتبة بالرقم (الترتيب مهم)
css/legacy/         كود قديم مش مستخدم دلوقتي (محتفظين بيه بس، ينفع يتمسح)
js/                 أجزاء الـJS مرتبة بالرقم (بتتجمع جوه دالة واحدة)
js/data/            بيانات الأقسام والمنتجات
assets/             صور وخطوط (بتتدمج تلقائيًا وقت البناء)
manifest.json       ترتيب ملفات css/js
dist/abuelfadl.html الناتج النهائي
```
ملاحظة: `js/legacy-card-tilt-and-header-height.js` فيه جزء قديم ميت (tilt الكروت) وجزء `setHH` لسه شغال، فسيبناه زي ما هو.

## لما نوصل للباك إند
`js/data/*.js` هو الجزء اللي هيتبدّل بطلب من API/قاعدة البيانات، وباقي الملفات تفضل زي ما هي.
