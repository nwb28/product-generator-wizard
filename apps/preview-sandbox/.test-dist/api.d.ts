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
            excelSimulation?: {
                enabled: boolean;
                capabilities: string[];
            };
            workforceSimulation?: {
                enabled: boolean;
                capabilities: string[];
            };
        };
    };
    artifacts?: {
        deterministicHash: string;
        files: Array<{
            path: string;
            content: string;
        }>;
    };
};
export declare function simulatePreview(payload: unknown): Promise<PreviewSimulateResponse>;
