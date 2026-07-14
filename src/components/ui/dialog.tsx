"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) { return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="app-dialog-overlay fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm"/><DialogPrimitive.Content className={cn("app-dialog fixed left-1/2 top-1/2 z-[81] max-h-[92dvh] w-[calc(100%-24px)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-[#111] shadow-2xl",className)} {...props}>{children}<DialogPrimitive.Close className="app-dialog__close absolute right-4 top-4 grid size-10 place-items-center rounded-xl border border-white/10 bg-zinc-900 text-zinc-400"><X className="size-4"/><span className="sr-only">Close</span></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal>; }
export const DialogTitle = ({ className,...props }: React.ComponentProps<typeof DialogPrimitive.Title>) => <DialogPrimitive.Title className={cn("text-xl font-semibold",className)} {...props}/>;
export const DialogDescription = ({ className,...props }: React.ComponentProps<typeof DialogPrimitive.Description>) => <DialogPrimitive.Description className={cn("text-sm text-zinc-500",className)} {...props}/>;
