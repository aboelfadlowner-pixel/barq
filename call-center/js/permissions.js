/* CONFIRMED: one shared call-center account with no roles — it can do everything
   (create and cancel orders, delivery areas and fees, the daily summary). */
export function can(user) {
  return !!user;
}
