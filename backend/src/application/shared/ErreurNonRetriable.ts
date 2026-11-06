/** Erreur métier qui ne doit jamais être réessayée par le runner de jobs. */
export class ErreurNonRetriable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurNonRetriable';
  }
}
