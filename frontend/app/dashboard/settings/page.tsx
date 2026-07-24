import { Settings2 } from "lucide-react";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Settings" />
      <EmptyState icon={Settings2} title="Settings — coming soon" />
    </div>
  );
}
