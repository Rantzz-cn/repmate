"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function FocusBackButton({ href = "/app", label = "Back to Dashboard" }: { href?: string; label?: string }) {
  const router = useRouter();
  const leave = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.closest(".focus-page")?.classList.add("is-leaving");
    window.setTimeout(() => router.push(href), 150);
  };
  return <button type="button" onClick={leave} className="focus-back"><ArrowLeft aria-hidden="true" /><span>{label}</span></button>;
}
