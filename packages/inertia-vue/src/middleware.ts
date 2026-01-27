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
}

/**
 * Inertia middleware factory for Vue
 */
export function inertiaMiddleware(options: VueAdapterOptions = {}): AdapterMiddlewareHandler {
  const { rootView = 'inertia.html', version = '1.0.0' } = options;

  return async (req: NaraRequest, res: NaraResponse, next: () => void) => {
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
          // In Nara, 'view' is usually imported from @services/View
          // We use dynamic import and cast to any to avoid type issues during library build
          const viewService: any = await import('@services/View' as any).catch(() => null);

          if (!viewService || !viewService.view) {
             throw new Error('View service unavailable');
          }

          const html = await viewService.view(rootView, {
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
