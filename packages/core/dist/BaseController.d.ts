import type { NaraRequest, NaraResponse, NaraResponseWithInertia, User } from './types';
import type { Validator } from '@validators/validate';
export type AuthenticatedRequest = NaraRequest & {
    user: User;
};
export type AdminRequest = NaraRequest & {
    user: User & {
        is_admin: true;
    };
};
export interface PaginationParams {
    page: number;
    limit: number;
    search: string;
}
export declare abstract class BaseController {
    constructor();
    protected requireInertia(res: NaraResponse): asserts res is NaraResponseWithInertia;
    protected requireAuth(req: NaraRequest): asserts req is AuthenticatedRequest;
    protected requireAdmin(req: NaraRequest): asserts req is AdminRequest;
    protected getBody<T>(req: NaraRequest, schema: Validator<T>): Promise<T>;
    protected getPaginationParams(req: NaraRequest): PaginationParams;
    protected getQueryParam(req: NaraRequest, key: string, defaultValue?: string): string;
    protected getParam(req: NaraRequest, key: string): string | undefined;
    protected getRequiredParam(req: NaraRequest, key: string): string;
}
export default BaseController;
//# sourceMappingURL=BaseController.d.ts.map