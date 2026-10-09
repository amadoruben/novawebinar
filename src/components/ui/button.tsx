import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative touch-hit inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium cursor-pointer transition-[color,background-color,box-shadow] duration-[var(--duration-fast)] ease-in-out focus-visible:outline-none focus-visible:ring-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
  {
    variants: {
      variant: {
        /* Geist default: preto no painel, laranja dentro da sala (uma por zona). */
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        /* Preto em qualquer sítio, também na sala. */
        dark: "bg-navy text-white hover:bg-navy-soft",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        /* Geist secondary: branco com aresta de 1px. */
        outline:
          "bg-white text-foreground shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)] hover:bg-gray-100 hover:shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-500)]",
        /* Cinza claro: botão de ferramenta. */
        secondary: "bg-chip text-foreground hover:bg-gray-150",
        /* Geist tertiary: sem fundo, cinza transparente ao passar. */
        ghost: "text-foreground hover:bg-[var(--ds-gray-alpha-200)]",
        link: "rounded-none px-0 text-foreground underline decoration-gray-300 underline-offset-4 hover:decoration-foreground",
      },
      size: {
        /* Alturas do Geist: medium 36, small 32, large 40 (raio 8). */
        default: "h-9 px-4",
        sm: "h-8 gap-1.5 px-3 text-[13px]",
        lg: "h-10 rounded-md px-5 text-[15px] [&_svg]:size-[18px]",
        icon: "size-9",
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
