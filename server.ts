import { createApp, svelteAdapter } from "@core";
import routes from "@routes/web";

const app = createApp({
  routes,
  adapter: svelteAdapter(),
  csrf: true,
});

app.start();
