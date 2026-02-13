import type { NaraRequest, NaraResponse } from './types';
export declare class BaseController {
    constructor();
    protected json(res: NaraResponse, data: any, status?: number): boolean;
    protected success(res: NaraResponse, data: any, message?: string): boolean;
    protected error(res: NaraResponse, message: string, status?: number): boolean;
    protected requireInertia(res: NaraResponse): void;
    protected requireAuth(req: NaraRequest): void;
    protected requireAdmin(req: NaraRequest): void;
    protected getBody<T = any>(req: NaraRequest, _schema?: any): Promise<T>;
    protected getPaginationParams(req: NaraRequest): {
        page: number;
        limit: number;
        search: string;
    };
    protected getQueryParam(req: NaraRequest, key: string, defaultValue?: string): string;
    protected getParam(req: NaraRequest, key: string): string | undefined;
    protected getRequiredParam(req: NaraRequest, key: string): string;
}
//# sourceMappingURL=BaseController.d.ts.map