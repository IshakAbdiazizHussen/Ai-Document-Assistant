import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
