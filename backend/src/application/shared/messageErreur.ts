/** Message lisible d'une erreur inconnue (catch sans type implicite). */
export function messageErreur(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
