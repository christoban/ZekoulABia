/** Sous-ensemble du runner de jobs (Inngest) utilisé par les use cases. */
export interface StepRunner {
  run(id: string, fn: () => Promise<unknown>): Promise<unknown>;
  sleep(id: string, duration: string): Promise<unknown>;
}
