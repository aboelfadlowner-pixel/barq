import type { Metadata } from "next";
import { ContactPage } from "@/features/contact/ContactPage";

export const metadata: Metadata = { title: "اتصل بنا · أبو الفضل ستور" };

/** «اتصل بنا»: phone, WhatsApp, social pages, branches and hours (from the dashboard settings). */
export default function Contact() {
  return <ContactPage />;
}
