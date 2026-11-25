import type { Metadata } from "next";
import { BackupCenter } from "@/components/admin/backups/backup-center";

export const metadata: Metadata = {
  title: "Telegram Backups",
};

export default function AdminBackupsPage() {
  return <BackupCenter />;
}
