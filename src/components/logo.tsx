import { siteConfig } from "@/config/site";

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
        <rect width="24" height="24" rx="6" fill="var(--primary)" />
        <path
          d="M6 16.5c3-1 4.5-3.5 6-6.5m0 0 .4 3.4M12 10l-3.2 1.2"
          fill="none"
          stroke="var(--primary-foreground)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="17" cy="7.5" r="1.8" fill="var(--accent)" />
      </svg>
      <span className="sr-only whitespace-nowrap sm:not-sr-only">
        {siteConfig.name}
      </span>
    </span>
  );
}
