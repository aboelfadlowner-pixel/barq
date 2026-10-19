import { DEFAULT_SETTINGS } from "../lib/settings";
import type { StoreSettings } from "../types/settings";
import { mutate, read } from "./db";
import { assertValid } from "./errors";

export async function getSettings(): Promise<StoreSettings> {
  return (await read()).settings ?? DEFAULT_SETTINGS;
}

/** Same rule as the checkout form: Egyptian mobile, 11 digits; Arabic-Indic digits, spaces and dashes are accepted. */
const cleanPhone = (value: string) => value.replace(/[\s-]/g, "").replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));

/** Updates the given settings; missing fields keep their value. */
export function updateSettings(input: Partial<Record<keyof StoreSettings, unknown>>): Promise<StoreSettings> {
  return mutate((data) => {
    const current = data.settings ?? DEFAULT_SETTINGS;
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

    assertValid(fields);
    const settings: StoreSettings = {
      minOrder: Math.round(minOrder * 100) / 100,
      notice,
      whatsapp,
      ordersOpen: input.ordersOpen === undefined ? current.ordersOpen : Boolean(input.ordersOpen),
      closedMessage,
    };
    data.settings = settings;
    return settings;
  });
}
