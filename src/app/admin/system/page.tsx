import type { Metadata } from "next";
import { SystemControlCenter } from "@/components/admin/system/system-control-center";

export const metadata: Metadata = {
  title: "System & Updates",
};

export default function AdminSystemPage() {
  return <SystemControlCenter />;
}
