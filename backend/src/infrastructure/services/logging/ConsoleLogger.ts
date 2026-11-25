import type { LoggerPort } from '@domain/ports/services/LoggerPort';

export class ConsoleLogger implements LoggerPort {
  error(message: string, error?: unknown): void {
    console.error(message, error);
  }

  warn(message: string): void {
    console.warn(message);
  }

  info(message: string): void {
    console.info(message);
  }
}
