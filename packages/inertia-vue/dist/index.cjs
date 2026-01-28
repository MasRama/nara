"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  createViteConfig: () => createViteConfig,
  initInertiaApp: () => initInertiaApp,
  vueAdapter: () => vueAdapter
});
module.exports = __toCommonJS(index_exports);

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
var import_plugin_vue = __toESM(require("@vitejs/plugin-vue"), 1);
function createViteConfig(options = {}) {
  return {
    plugins: [
      (0, import_plugin_vue.default)(options.vueOptions)
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

// src/client/app.ts
var import_vue = require("vue");
var import_vue3 = require("@inertiajs/vue3");
var import_meta = {};
function initInertiaApp(options = {}) {
  const {
    el = "#app",
    resolve = (name) => {
      const pages = import_meta.glob("./pages/**/*.vue", { eager: true });
      return pages[`./pages/${name}.vue`];
    }
  } = options;
  (0, import_vue3.createInertiaApp)({
    resolve,
    setup({ el: element, App, props, plugin }) {
      (0, import_vue.createApp)({ render: () => (0, import_vue.h)(App, props) }).use(plugin).mount(element);
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createViteConfig,
  initInertiaApp,
  vueAdapter
});
