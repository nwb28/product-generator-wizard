export type PreviewView = {
    id: string;
    title: string;
    payload: Record<string, unknown>;
};
export declare function normalizePreviewViews(views: PreviewView[]): PreviewView[];
