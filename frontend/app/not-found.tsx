import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <FileQuestion className="size-10 text-muted-foreground" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you&rsquo;re looking for doesn&rsquo;t exist.
        </p>
      </div>
      <Button render={<Link href="/dashboard" />} nativeButton={false} variant="secondary">
        Back to Dashboard
      </Button>
    </div>
  );
}
