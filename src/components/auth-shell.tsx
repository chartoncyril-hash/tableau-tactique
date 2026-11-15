import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader showAuthLinks={false} />
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </Card>
      </main>
    </>
  );
}
