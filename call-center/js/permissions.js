/* CONFIRMED: three roles (set by the admin from «المناطق والموظفين»).
   admin       — everything, plus areas/fees, employee names, the registration code and accounts.
   call_center — creates, follows and cancels orders. No settings.
   prep        — the person preparing orders at the branch: the preparation screen only.
   The database enforces the same rules; this only decides what is shown. */
const ALLOWED = {
  admin:       ['orders', 'createOrder', 'cancelOrder', 'viewDailySummary', 'manageAreas', 'manageAccounts', 'prepScreen'],
  call_center: ['orders', 'createOrder', 'cancelOrder', 'viewDailySummary'],
  prep:        ['prepScreen'],
};

export const ROLES = [
  { id: 'admin',       label: 'أدمن' },
  { id: 'call_center', label: 'كول سنتر' },
  { id: 'prep',        label: 'تجهيز' },
];

export function can(user, action) {
  if (!user) return false;
  if (!action) return true;
  return (ALLOWED[user.role] || []).includes(action);
}

/* The branch preparation account sees only its screen. */
export const isPrepOnly = (user) => user?.role === 'prep';
