import type { Metadata } from "next";
import AdminApp from "./AdminApp";

export const metadata: Metadata = {
  title: "Admin · Prodintro.com",
  robots: { index: false, follow: false },
};

/** The owner's admin area (enabled by ADMIN_PASSWORD). */
export default function Admin() {
  return <AdminApp />;
}
