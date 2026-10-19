import { withDefaults } from "../lib/settings";
import type { Branch, StoreSettings } from "../types/settings";
import { mutate, read } from "./db";
import { assertValid } from "./errors";

export async function getSettings(): Promise<StoreSettings> {
  return withDefaults((await read()).settings);
}

/** Same rule as the checkout form: Egyptian mobile, 11 digits; Arabic-Indic digits, spaces and dashes are accepted. */
const cleanPhone = (value: string) => value.replace(/[\s-]/g, "").replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));

/** Branch rows from the settings form: empty rows are dropped; errors go to fields.branches. */
function cleanBranches(value: unknown, fields: Record<string, string>): Branch[] {
  if (!Array.isArray(value) || value.length > 20) {
    fields.branches = "قائمة الفروع مش مظبوطة";
    return [];
  }
  const branches: Branch[] = [];
  for (const row of value as Partial<Record<keyof Branch, unknown>>[]) {
    const branch = { name: String(row?.name ?? "").trim(), address: String(row?.address ?? "").trim(), mapUrl: String(row?.mapUrl ?? "").trim() };
    if (!branch.name && !branch.address && !branch.mapUrl) continue;
    if (branch.name.length < 2 || branch.name.length > 60) fields.branches = "اكتب اسم كل فرع (من 2 لـ 60 حرف)";
    else if (branch.address.length > 150) fields.branches = "العنوان طويل (أقصى حد 150 حرف)";
    else if (branch.mapUrl && !/^https:\/\/\S+$/.test(branch.mapUrl)) fields.branches = "لينك الخريطة لازم يبدأ بـ https://";
    branches.push(branch);
  }
  return branches;
}

/** Updates the given settings; missing fields keep their value. */
export function updateSettings(input: Partial<Record<keyof StoreSettings, unknown>>): Promise<StoreSettings> {
  return mutate((data) => {
    const current = withDefaults(data.settings);
    const fields: Record<string, string> = {};
    const text = (value: unknown, fallback: string) => (value === undefined ? fallback : String(value).trim());

    const minOrder = input.minOrder === undefined ? current.minOrder : Number(input.minOrder);
    if (!Number.isFinite(minOrder) || minOrder < 0 || minOrder > 10000) fields.minOrder = "اكتب رقم من 0 لـ 10000 (0 = من غير حد أدنى)";

    const notice = text(input.notice, current.notice);
    if (notice.length > 150) fields.notice = "الجملة طويلة (أقصى حد 150 حرف)";

    const whatsapp = input.whatsapp === undefined ? current.whatsapp : cleanPhone(String(input.whatsapp));
    if (whatsapp && !/^01[0125][0-9]{8}$/.test(whatsapp)) fields.whatsapp = "اكتب رقم موبايل مصري صحيح من 11 رقم، أو سيبه فاضي";

    const closedMessage = text(input.closedMessage, current.closedMessage);
    if (closedMessage.length < 5 || closedMessage.length > 150) fields.closedMessage = "اكتب رسالة من 5 لـ 150 حرف";

    const phone = input.phone === undefined ? current.phone : cleanPhone(String(input.phone));
    if (phone && !/^[0-9]{5,15}$/.test(phone)) fields.phone = "اكتب الرقم أرقام بس (موبايل أو أرضي أو خط ساخن)";

    const link = (key: "facebook" | "instagram" | "tiktok") => {
      const value = text(input[key], current[key]);
      if (value && !/^https:\/\/\S+$/.test(value)) fields[key] = "اللينك لازم يبدأ بـ https://";
      return value;
    };
    const facebook = link("facebook");
    const instagram = link("instagram");
    const tiktok = link("tiktok");

    const workHours = text(input.workHours, current.workHours);
    if (workHours.length > 80) fields.workHours = "أقصى حد 80 حرف";
    const deliveryHours = text(input.deliveryHours, current.deliveryHours);
    if (deliveryHours.length > 80) fields.deliveryHours = "أقصى حد 80 حرف";

    const offersTitle = text(input.offersTitle, current.offersTitle);
    if (offersTitle.length < 2 || offersTitle.length > 40) fields.offersTitle = "اكتب اسم من 2 لـ 40 حرف";

    const offersKicker = text(input.offersKicker, current.offersKicker);
    if (offersKicker.length > 40) fields.offersKicker = "أقصى حد 40 حرف";

    const branches = input.branches === undefined ? current.branches : cleanBranches(input.branches, fields);

    assertValid(fields);
    const settings: StoreSettings = {
      minOrder: Math.round(minOrder * 100) / 100,
      notice,
      whatsapp,
      ordersOpen: input.ordersOpen === undefined ? current.ordersOpen : Boolean(input.ordersOpen),
      closedMessage,
      phone,
      facebook,
      instagram,
      tiktok,
      workHours,
      deliveryHours,
      branches,
      offersTitle,
      offersKicker,
    };
    data.settings = settings;
    return settings;
  });
}
