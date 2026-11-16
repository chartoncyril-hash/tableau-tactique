"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    await createClient().auth.signOut();
    // Pas de refresh juste après : il peut annuler la navigation. La page cible est rendue à la requête.
    router.replace("/");
  }

  return (
    <Button variant="outline" onClick={onClick} disabled={pending}>
      <LogOut aria-hidden />
      {t("logout")}
    </Button>
  );
}
