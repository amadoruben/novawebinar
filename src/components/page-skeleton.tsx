import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageSkeleton({
  variant = "cards",
  className,
}: {
  variant?: "cards" | "table" | "editor" | "calendar" | "chat";
  className?: string;
}) {
  if (variant === "editor") {
    return (
      <div className={cn("grid gap-4 lg:grid-cols-[220px_1fr]", className)} aria-hidden="true">
        <Skeleton className="h-[520px] rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (variant === "calendar") {
    return (
      <div className={cn("space-y-4", className)} aria-hidden="true">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "chat") {
    return (
      <div
        className={cn("grid min-h-[480px] gap-4 md:grid-cols-[280px_1fr]", className)}
        aria-hidden="true"
      >
        <Skeleton className="h-full" />
        <div className="space-y-5 rounded-md border p-5">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="ml-auto h-16 w-2/3" />
          <Skeleton className="h-16 w-3/5" />
          <Skeleton className="ml-auto h-16 w-1/2" />
        </div>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={cn("overflow-hidden rounded-lg border", className)} aria-hidden="true">
        <Skeleton className="h-14 rounded-none" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="grid grid-cols-4 gap-5 border-t p-4">
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)} aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="space-y-3 rounded-lg border p-4">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
