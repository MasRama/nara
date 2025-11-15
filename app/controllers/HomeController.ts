import { Response, Request } from "../../type"; 
import DB from "../services/DB";

class Controller {
    
    public async index (request : Request,response : Response) { 
        let user: any = {};

        if (request.cookies.auth_id) {
            const session = await DB.from("sessions").where("id", request.cookies.auth_id).first();

            if (session) {
                user = await DB.from("users")
                    .where("id", session.user_id)
                    .select(["id","name","email","phone","avatar","is_admin","is_verified"])
                    .first();
            }
        }

        return response.inertia("landing", { user });
    }
}

export default new Controller()
