import type { Metadata } from "next";
import { AdminPanel } from "./AdminPanel";

export const metadata: Metadata = {
  title: "Управление сайтом",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminPage() {
  return <AdminPanel />;
}
