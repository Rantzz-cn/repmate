import * as React from "react";
import { cn } from "@/lib/utils";
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) { return <input className={cn("h-12 w-full rounded-xl border border-white/10 bg-[#161616] px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/35 focus:ring-2 focus:ring-white/10", className)} {...props} />; }
