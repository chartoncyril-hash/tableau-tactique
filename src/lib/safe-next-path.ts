/**
 * Valide la cible de redirection reçue après authentification.
 * N'accepte que des chemins internes pour éviter les redirections ouvertes.
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/",
): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
