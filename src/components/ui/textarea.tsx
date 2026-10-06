import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-24 w-full rounded-sm border border-gray-250 bg-white px-3 py-2.5 text-base transition-[border-color,box-shadow] duration-[var(--duration-fast)] placeholder:text-gray-500 hover:border-gray-300 focus-visible:outline-none focus-visible:border-gray-400 focus-visible:ring-field disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60 md:text-sm",
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
