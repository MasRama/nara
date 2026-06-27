import { createWebApp, svelteAdapter } from "@core";
import routes from "@routes/web";

const app = createWebApp({
  routes,
  adapter: svelteAdapter(),
});

app.start();
