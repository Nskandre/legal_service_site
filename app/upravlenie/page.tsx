import type { Metadata } from "next";
import { AdminPanel } from "./AdminPanel";

export const metadata: Metadata = {
  title: "Управление сайтом",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function AdminPage() {
  return <AdminPanel />;
}
