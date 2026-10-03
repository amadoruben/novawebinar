import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-pill border border-gray-250 bg-white px-4 py-2 text-base transition-[border-color,box-shadow,background-color] duration-[var(--duration-fast)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-gray-500 hover:border-gray-300 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-focus disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60 aria-[invalid=true]:border-destructive md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
