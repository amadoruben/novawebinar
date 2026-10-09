import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-24 w-full rounded-sm border border-control bg-white px-3 py-2.5 text-base transition-[border-color,box-shadow] duration-[var(--duration-fast)] placeholder:text-[var(--text-tertiary)] hover:border-gray-600 focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-field disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
