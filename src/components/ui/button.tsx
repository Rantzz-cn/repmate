import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60", {
  variants: { variant: { default: "bg-white text-black hover:bg-zinc-200", secondary: "border border-white/10 bg-zinc-900 text-white hover:bg-zinc-800", ghost: "text-zinc-300 hover:bg-white/5 hover:text-white", danger: "border border-red-500/20 bg-red-500/10 text-red-400" }, size: { default: "h-11", sm: "min-h-9 rounded-lg px-3 text-xs", icon: "size-11 p-0" } },
  defaultVariants: { variant: "default", size: "default" },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export function Button({ className, variant, size, ...props }: ButtonProps) { return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />; }
export { buttonVariants };
