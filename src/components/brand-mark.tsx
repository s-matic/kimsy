import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("relative inline-flex h-7 w-7 shrink-0 overflow-hidden", className)}><Image src="/kimsy-icon.svg" alt="" fill sizes="40px" className="scale-[1.18] object-contain" /></span>;
}
