import { WebClient } from '@slack/web-api';
import { Logger } from '@slack/logger';
import { Middleware, AnyMiddlewareArgs, Context } from '../types';
import { MiddlewareNextError } from '../errors';

/**
 * Iterate through provided middleware using the arguments and context of the
 * associated App handler. The next middleware is called when the current one
 * calls next(). Evaluation is done as a recursive chain and that idea.
 *
 * @param middleware array of middleware handlers as functions.
 * @param initialArgs arguments provided to the middleware from the App.
 * @param context information associated with a request.
 * @param client the gateway to calling Slack API methods.
 * @param logger an interface for logging messages and details.
 * @param last middleware called after provided middleware.
 * @returns an asynchronous promise of eventual completion.
 */
export default async function processMiddleware(
  middleware: Middleware<AnyMiddlewareArgs>[],
  initialArgs: AnyMiddlewareArgs,
  context: Context,
  client: WebClient,
  logger: Logger,
  last: () => Promise<void> = async () => { },
): Promise<void> {
  if (middleware.length <= 0) {
    return last();
  }
  let lastCalledMiddlewareIndex = -1;

  /**
   * Evaluate a given middleware using an index while also setting the next()
   * chain to the next middleware with a counter scoped to the outer function.
   *
   * @param toCallMiddlewareIndex specifies the middleware to call.
   * @returns the invocation results of the middleware function with arguments.
   */
  async function invokeMiddleware(toCallMiddlewareIndex: number): ReturnType<Middleware<AnyMiddlewareArgs>> {
    if (lastCalledMiddlewareIndex >= toCallMiddlewareIndex) {
      throw new MiddlewareNextError('next() called multiple times');
    }
    lastCalledMiddlewareIndex = toCallMiddlewareIndex;
    if (toCallMiddlewareIndex >= middleware.length) {
      return last();
    }
    const fn = middleware[toCallMiddlewareIndex];
    return fn({
      next: () => invokeMiddleware(toCallMiddlewareIndex + 1),
      ...initialArgs,
      context,
      client,
      logger,
    });
  }

  return invokeMiddleware(0);
}
