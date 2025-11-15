import { Response, Request } from "../../type"; 

class Controller {
    
    public async index (request : Request,response : Response) { 
        return response.inertia("landing");
    }
}

export default new Controller()
