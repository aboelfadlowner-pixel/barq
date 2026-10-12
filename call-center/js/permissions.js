/* CONFIRMED: two accounts. The supervisor can do everything the agent does, plus: */
const SUPERVISOR_ONLY = new Set(['cancelOrder', 'manageAreas', 'viewDailySummary']);

export const ROLE_LABELS = { agent: 'موظف', supervisor: 'مشرف' };

export function can(user, action) {
  if (!user) return false;
  if (SUPERVISOR_ONLY.has(action)) return user.role === 'supervisor';
  return true;
}
