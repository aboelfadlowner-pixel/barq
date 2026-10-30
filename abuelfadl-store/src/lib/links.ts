/**
 * Address of the store for the dashboard's «فتح المتجر» links. With the store and the dashboard deployed apart
 * (`APP_PART`), set NEXT_PUBLIC_STORE_URL to the store's address; on one site it stays "/".
 */
export const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || "/";
