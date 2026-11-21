import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "scienta-btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-(--color-text-primary) disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "scienta-btn-primary bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) text-white shadow-[0_8px_30px_-8px_rgba(var(--color-accent-glow-rgb),0.6)] hover:shadow-[0_12px_40px_-8px_rgba(var(--color-accent-glow-rgb),0.8)] hover:scale-[1.03] active:scale-[0.98]",
        secondary:
          "scienta-btn-secondary glass-panel text-(--color-text-primary) hover:border-(--color-border-strong) hover:scale-[1.02]",
        ghost:
          "text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-white/5",
        outline:
          "border border-(--color-border-strong) text-(--color-text-primary) hover:bg-white/5",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        md: "h-11 px-6",
        lg: "h-14 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  href?: string;
}

export function Button({ className, variant, size, href, children, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
