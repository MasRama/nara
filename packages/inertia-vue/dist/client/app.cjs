"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/app.ts
var app_exports = {};
__export(app_exports, {
  initInertiaApp: () => initInertiaApp
});
module.exports = __toCommonJS(app_exports);
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
  initInertiaApp
});
