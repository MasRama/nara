import { view } from "@services/View";
import type { NaraRequest, NaraResponse, NaraMiddleware } from "@core";

const VERSION = "1.0.0";

export const renderer = (): NaraMiddleware => {
  return (req: NaraRequest, res: NaraResponse, next) => {
    res.inertia = async (component, inertiaProps = {}, viewProps = {}) => {
      const protocol = req.secure ? 'https' : 'http';
      const url = `${protocol}://${req.get("host")}${req.originalUrl}`;

      const props = {
        user: req.user
          ? {
              id: req.user.id,
              name: req.user.name,
              email: req.user.email,
              avatar: req.user.avatar,
              roles: req.user.roles || [],
              permissions: req.user.permissions || [],
            }
          : {},
        ...inertiaProps,
        ...viewProps,
        error: null,
      } as any;

      if (req.cookies.error) {
        props.error = req.cookies.error;
        res.clearCookie("error");
      }

      const inertiaObject = {
        component,
        props,
        url,
        version: VERSION,
      };

      if (!req.header("X-Inertia")) {
        const html = await view("inertia.html", {
          page: JSON.stringify(inertiaObject),
          title: process.env.TITLE || "Pure Speed & Control",
        });
        return res.type("html").send(html);
      }

      res.setHeader("Vary", "Accept");
      res.setHeader("X-Inertia", "true");
      res.setHeader("X-Inertia-Version", VERSION);

      return res.json(inertiaObject);
    };

    next();
  };
};

export default renderer;
