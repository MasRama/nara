import type { NaraRequest, NaraResponse } from "@core";
import { BaseController } from "@core";
import { Session, User } from "@models";

class HomeController extends BaseController {
    
    public async index(request: NaraRequest, response: NaraResponse) {
        let user: any = {};

        if (request.cookies.auth_id) {
            const session = await Session.findById(request.cookies.auth_id);

            if (session) {
                user = await User.findById(session.user_id);
            }
        }

        this.requireInertia(response);
        return response.inertia("landing", { user });
    }
}

export default new HomeController()
