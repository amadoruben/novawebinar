import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-normal cursor-pointer transition-[color,background-color,box-shadow,transform] duration-[var(--duration-fast)] ease-standard active:scale-[.97] focus-visible:outline-none focus-visible:ring-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
  {
    variants: {
      variant: {
        /* Laranja live: a acção principal do ecrã (uma por zona). */
        default: "bg-primary text-primary-foreground hover:bg-accent-strong",
        /* Azul-noite: acção forte secundária. */
        dark: "bg-navy text-white hover:bg-navy-soft",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        /* Branco: acção secundária sobre canvas ou cartão. */
        outline:
          "bg-white text-foreground shadow-[inset_0_0_0_1px_var(--gray-250)] hover:bg-gray-50 hover:shadow-[inset_0_0_0_1px_var(--gray-300)]",
        /* Cinza claro: pílula de ferramenta. */
        secondary: "bg-chip text-foreground hover:bg-gray-250",
        ghost: "text-foreground hover:bg-[var(--hover-ghost)]",
        link: "rounded-none px-0 text-foreground underline decoration-primary underline-offset-4 hover:text-gray-700 active:scale-100",
      },
      size: {
        default: "h-10 px-[18px]",
        sm: "h-8 gap-1.5 px-3.5 text-xs [&_svg]:size-3.5",
        lg: "h-12 px-[22px] text-[15px] [&_svg]:size-[18px]",
        icon: "size-10 active:scale-[.94]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
