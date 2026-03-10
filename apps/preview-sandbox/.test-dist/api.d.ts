export type PreviewSimulateResponse = {
    validation: {
        valid: boolean;
        summary: {
            blocking: number;
            warning: number;
        };
    };
    output: {
        previewSession: {
            views: Array<{
                id: string;
                title: string;
                payload: Record<string, unknown>;
            }>;
        };
    };
};
export declare function simulatePreview(payload: unknown): Promise<PreviewSimulateResponse>;
