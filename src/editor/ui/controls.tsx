"use client";

import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function IconButton({
  icon: Icon,
  label,
  active,
  className,
  ...props
}: { icon: LucideIcon; label: string; active?: boolean } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
        className,
      )}
      {...props}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

export function Chip({
  active,
  className,
  ...props
}: { active?: boolean } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-sm whitespace-nowrap transition-colors md:h-9",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b p-4 last:border-b-0">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0 text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const control =
  "h-9 min-w-0 rounded-md border border-input bg-card px-2 text-sm disabled:opacity-50";

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "w-36 shrink-0", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "w-36 shrink-0", className)} {...props} />;
}

export function ColorInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      type="color"
      className={cn("h-9 w-12 cursor-pointer rounded-md border border-input bg-card p-1", className)}
      {...props}
    />
  );
}

export function Range({ className, ...props }: ComponentProps<"input">) {
  return <input type="range" className={cn("w-32 shrink-0 accent-primary", className)} {...props} />;
}

export function Check({ label, ...props }: { label: string } & ComponentProps<"input">) {
  return (
    <label className="flex min-h-9 items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-primary" {...props} />
      {label}
    </label>
  );
}
