import {
  initInertiaApp
} from "./chunk-ZSN4VNUJ.js";

// src/middleware.ts
function inertiaMiddleware(options = {}) {
  const { rootView = "inertia.html", version = "1.0.0", viewFn = null } = options;
  return (req, res, next) => {
    res.inertia = async (component, inertiaProps = {}, viewProps = {}) => {
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const props = {
        user: req.user || {},
        ...inertiaProps,
        ...viewProps,
        error: req.cookies?.error || null
      };
      if (req.cookies?.error) {
        res.clearCookie("error");
      }
      const inertiaObject = {
        component,
        props,
        url,
        version
      };
      if (!req.header("X-Inertia")) {
        try {
          let viewFunc = viewFn;
          if (!viewFunc) {
            const viewService = await import("@services/View").catch(() => null);
            viewFunc = viewService?.view;
          }
          if (!viewFunc) {
            throw new Error("View service unavailable");
          }
          const html = await viewFunc(rootView, {
            page: JSON.stringify(inertiaObject),
            title: process.env["TITLE"] || "Nara App"
          });
          return res.type("html").send(html);
        } catch (e) {
          return res.status(500).send("Root view not found or View service unavailable");
        }
      }
      res.setHeader("Vary", "Accept");
      res.setHeader("X-Inertia", "true");
      res.setHeader("X-Inertia-Version", version);
      return res.json(inertiaObject);
    };
    next();
  };
}

// src/adapter.ts
function vueAdapter(options = {}) {
  return {
    name: "vue-inertia",
    /**
     * Factory that returns the adapter's global middleware
     */
    middleware: () => inertiaMiddleware(options),
    /**
     * Method called during app initialization to extend the NaraResponse
     */
    extendResponse: (_res) => {
    }
  };
}

// src/vite.ts
import vue from "@vitejs/plugin-vue";
function createViteConfig(options = {}) {
  return {
    plugins: [
      vue(options.vueOptions)
    ],
    resolve: {
      alias: {
        "@": "/resources/js"
      }
    },
    build: {
      outDir: "public/build",
      manifest: true,
      rollupOptions: {
        input: "resources/js/app.ts"
      }
    }
  };
}
export {
  createViteConfig,
  initInertiaApp,
  vueAdapter
};
