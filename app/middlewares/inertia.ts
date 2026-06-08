import { view } from "@services/View"; 
import type { NaraRequest as Request, NaraResponse as Response, NaraMiddleware } from "@core";

let pkg = {version : "1.0.0"};

const inertia = (): NaraMiddleware => {
   return (req: Request, res: Response, next) => { 
      res.inertia = async (component, inertiaProps = {}, viewProps = {}) => {
         
         const protocol = req.secure ? 'https' : 'http';
         const url = `${protocol}://${req.get("host")}${req.originalUrl}`;

         let props = {
            user: req.user
               ? {
                    id: req.user.id,
                    name: req.user.name,
                    email: req.user.email,
                    phone: req.user.phone,
                    avatar: req.user.avatar,
                    roles: req.user.roles || [],
                    permissions: req.user.permissions || [],
                    is_verified: req.user.is_verified,
                 }
               : {},
            ...inertiaProps,
            ...viewProps,
            error: null,
         } as any;

         

         if(req.cookies.error)
         {
            props.error = req.cookies.error; 
            res.clearCookie("error")
         }

         const inertiaObject = {
            component: component,
            props: props,
            url: url,
            version: pkg.version,
         };

         if (!req.header("X-Inertia")) {
            const html = await view("inertia.html", {
               page: JSON.stringify(inertiaObject),
               title:  process.env.TITLE ||  "Pure Speed & Control",
            });

            return res.type("html").send(html);
         }

         res.setHeader("Vary", "Accept");
         res.setHeader("X-Inertia", "true");
         res.setHeader("X-Inertia-Version", pkg.version);

         return res.json(inertiaObject);
      };

      next();
   };
};

export default inertia;
