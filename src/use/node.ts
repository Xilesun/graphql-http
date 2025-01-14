import type { IncomingMessage, RequestListener } from 'http';
import {
  createHandler as createRawHandler,
  HandlerOptions,
  OperationContext,
} from '../handler';

/**
 * Create a GraphQL over HTTP Protocol compliant request handler for
 * the Node environment.
 *
 * ```js
 * import http from 'http';
 * import { createHandler } from 'graphql-http/lib/use/node';
 * import { schema } from './my-graphql-step';
 *
 * const server = http.createServer(createHandler({ schema }));
 *
 * server.listen(4000);
 * console.log('Listening to port 4000');
 * ```
 *
 * @category Server/node
 */
export function createHandler<Context extends OperationContext = undefined>(
  options: HandlerOptions<IncomingMessage, undefined, Context>,
): RequestListener {
  const isProd = process.env.NODE_ENV === 'production';
  const handle = createRawHandler(options);
  return async function requestListener(req, res) {
    try {
      if (!req.url) {
        throw new Error('Missing request URL');
      }
      if (!req.method) {
        throw new Error('Missing request method');
      }
      const [body, init] = await handle({
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: () =>
          new Promise<string>((resolve) => {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => resolve(body));
          }),
        raw: req,
        context: undefined,
      });
      res.writeHead(init.status, init.statusText, init.headers).end(body);
    } catch (err) {
      // The handler shouldnt throw errors.
      // If you wish to handle them differently, consider implementing your own request handler.
      console.error(
        'Internal error occurred during request handling. ' +
          'Please check your implementation.',
        err,
      );
      if (isProd) {
        res.writeHead(500).end();
      } else {
        res
          .writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
          .end(
            JSON.stringify({
              errors: [
                err instanceof Error
                  ? {
                      message: err.message,
                      stack: err.stack,
                    }
                  : err,
              ],
            }),
          );
      }
    }
  };
}
