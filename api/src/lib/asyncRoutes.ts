import type { NextFunction, Request, RequestHandler, Response, Router } from "express";

/**
 * Make async route handlers safe.
 *
 * Express 4 predates promises: it only forwards errors a handler throws
 * *synchronously* or passes to `next()`. An `await` that rejects — a dropped
 * database connection, say — becomes an unhandled rejection instead, and Node
 * kills the process for those by default. So a single blip on the Postgres
 * link doesn't fail one request, it takes the whole API down until someone
 * restarts it.
 *
 * This walks a router's stack after its routes are declared and wraps every
 * handler so rejections reach the error middleware, which answers 500 and
 * leaves the server running.
 */

interface Layer {
  route?: { stack: { handle: RequestHandler }[] };
  handle: RequestHandler;
  name?: string;
}

function wrap(fn: RequestHandler): RequestHandler {
  // Error-handling middleware takes four args and must keep its arity.
  if (fn.length >= 4) return fn;
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      Promise.resolve(fn(req, res, next)).catch(next);
    } catch (err) {
      next(err);
    }
  };
}

export function catchAsync<T extends Router>(router: T): T {
  const stack = (router as unknown as { stack: Layer[] }).stack ?? [];
  for (const layer of stack) {
    if (layer.route) {
      // A declared route: GET /x, POST /y …
      for (const entry of layer.route.stack) entry.handle = wrap(entry.handle);
    } else if (typeof layer.handle === "function" && layer.name !== "router") {
      // router.use(...) middleware — requireAuth lives here.
      layer.handle = wrap(layer.handle);
    }
  }
  return router;
}
