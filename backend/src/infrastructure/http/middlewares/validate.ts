import { type Request, type Response, type NextFunction } from "express";
import { type ZodTypeAny, ZodError } from "zod";

interface SchemaBundle {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export const validate = (schemas: SchemaBundle) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query);

        // In Express 5, req.query can be implemented as a getter-only property
        // depending on runtime internals, so direct assignment may throw.
        try {
          req.query = parsedQuery;
        } catch {
          req.validatedQuery = parsedQuery;
        }
      }

      return next();
    } catch (error) {
      if (error instanceof ZodError || (error as Error)?.name === "ZodError") {
        const issues = (error as ZodError).issues || [];
        return res.status(400).json({
          message: "Validation failed",
          errors: issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      return res.status(500).json({
        message: "Validation middleware error",
        error: error instanceof Error ? error.message : "Unknown validation error",
      });
    }
  };
};
