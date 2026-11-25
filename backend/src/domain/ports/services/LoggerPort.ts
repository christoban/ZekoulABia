export interface LoggerPort {
  error(message: string, error?: unknown): void;
  warn(message: string): void;
  info(message: string): void;
}