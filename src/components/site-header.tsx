import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader({ showAuthLinks = true }: { showAuthLinks?: boolean }) {
  const t = useTranslations("common");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4">
        <Link href="/" className="rounded-md">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1" aria-label={t("mainNav")}>
          <LocaleSwitcher />
          <ThemeToggle />
          {showAuthLinks ? (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "hidden sm:inline-flex",
                )}
              >
                {t("login")}
              </Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                {t("signup")}
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
