import type { NaraRequest, NaraResponse, AdapterMiddlewareHandler } from './types';

export interface VueAdapterOptions {
  /**
   * The root view template file name
   * @default 'inertia.html'
   */
  rootView?: string;
  /**
   * The version of the assets
   * @default '1.0.0'
   */
  version?: string;
  /**
   * Optional view function to render templates
   * If not provided, will try to import from @services/View
   */
  viewFn?: (filename: string, data?: any) => string | Promise<string>;
}

/**
 * Inertia middleware factory for Vue
 * 
 * NOTE: This middleware must NOT be async because HyperExpress
 * does not allow calling next() after await in async middlewares.
 * The res.inertia method can be async, but the middleware wrapper must be sync.
 */
export function inertiaMiddleware(options: VueAdapterOptions = {}): AdapterMiddlewareHandler {
  const { rootView = 'inertia.html', version = '1.0.0', viewFn = null } = options;

  // Return a SYNCHRONOUS middleware (no async keyword!)
  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    // Add res.inertia method to the response object
    res.inertia = async (component: string, inertiaProps: Record<string, any> = {}, viewProps: Record<string, any> = {}) => {
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

      // Prepare shared props (usually from request or auth)
      const props = {
        user: (req as any).user || {},
        ...inertiaProps,
        ...viewProps,
        error: req.cookies?.error || null,
      };

      if (req.cookies?.error) {
        res.clearCookie('error');
      }

      const inertiaObject = {
        component,
        props,
        url,
        version,
      };

      // Check if it's an XHR Inertia request
      if (!req.header('X-Inertia')) {
        // Full page render
        try {
          // Use provided viewFn or try to import from @services/View
          let viewFunc = viewFn;
          if (!viewFunc) {
            const viewService: any = await import('@services/View' as any).catch(() => null);
            viewFunc = viewService?.view;
          }

          if (!viewFunc) {
            throw new Error('View service unavailable');
          }

          const html = await viewFunc(rootView, {
            page: JSON.stringify(inertiaObject),
            title: process.env['TITLE'] || 'Nara App',
          });

          return res.type('html').send(html);
        } catch (e) {
          // Fallback if view service is not available or fails
          return res.status(500).send('Root view not found or View service unavailable');
        }
      }

      // Inertia AJAX response
      res.setHeader('Vary', 'Accept');
      res.setHeader('X-Inertia', 'true');
      res.setHeader('X-Inertia-Version', version);

      return res.json(inertiaObject);
    };

    next();
  };
}
