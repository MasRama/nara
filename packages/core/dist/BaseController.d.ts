import type { NaraResponse } from './types';
export declare class BaseController {
    constructor();
    protected json(res: NaraResponse, data: any, status?: number): boolean;
    protected success(res: NaraResponse, data: any, message?: string): boolean;
    protected error(res: NaraResponse, message: string, status?: number): boolean;
    protected requireInertia(res: NaraResponse): void;
}
//# sourceMappingURL=BaseController.d.ts.map