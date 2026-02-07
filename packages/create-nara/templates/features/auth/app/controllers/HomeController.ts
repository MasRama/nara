/**
 * HomeController
 * 
 * Handles the landing page and public home routes.
 */
import { BaseController } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import { Session } from '@models';
import { User } from '@models';

class HomeController extends BaseController {
  /**
   * Landing page
   */
  public async index(request: NaraRequest, response: NaraResponse) {
    let user: any = {};

    if (request.cookies?.auth_id) {
      const session = await Session.findById(request.cookies.auth_id);

      if (session) {
        user = await User.findById(session.user_id);
      }
    }

    this.requireInertia(response);
    return response.inertia('landing', { user });
  }
}

export default new HomeController();
export { HomeController };
