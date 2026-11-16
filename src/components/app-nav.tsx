"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/app", key: "projects", match: (p: string) => p === "/app" },
  { href: "/app/teams", key: "teams", match: (p: string) => p.startsWith("/app/teams") },
] as const;

/** Onglets de l'espace connecté : projets et effectifs. */
export function AppNav() {
  const t = useTranslations("appNav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="mb-6 flex gap-1 border-b">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex h-11 items-center border-b-2 px-4 text-sm font-medium transition-colors",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
