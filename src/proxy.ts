import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "./lib/supabase/env";

const handleI18n = createIntlMiddleware(routing);

const protectedPath = new RegExp(
  `^/(${routing.locales.join("|")})/app(/|$)`,
);

export default async function proxy(request: NextRequest) {
  const response = handleI18n(request);
  const match = request.nextUrl.pathname.match(protectedPath);

  let hasUser = false;

  if (isSupabaseConfigured) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // Rafraîchit la session ; la vérification d'autorité reste côté serveur.
    const { data } = await supabase.auth.getUser();
    hasUser = Boolean(data.user);
  }

  if (match && !hasUser) {
    const url = request.nextUrl.clone();
    url.pathname = `/${match[1]}/login`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: "/((?!api|auth|_next|_vercel|.*\\..*).*)",
};
