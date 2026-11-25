declare global {
  namespace Express {
    interface Request {
      // treat route params as simple string map within this project
      params: Record<string, string>;

      // masterUser is attached by master auth middleware; keep it permissive
      masterUser?: {
        id: string;
        role: string;
        [key: string]: any;
      } | null;

      // Fallback set by middleware/validate.ts when req.query is a getter-only property
      // (observed on some Express 5 runtime internals) and direct assignment throws.
      validatedQuery?: any;
    }
  }
}

export {};
