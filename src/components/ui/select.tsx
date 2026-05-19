import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("h-10 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary", className)} {...props} />;
}
