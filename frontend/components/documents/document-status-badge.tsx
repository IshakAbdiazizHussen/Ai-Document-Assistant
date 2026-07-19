import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/lib/types/document";

const STATUS_STYLES: Record<DocumentStatus, string> = {
  processing:
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ready:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
