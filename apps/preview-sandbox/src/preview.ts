export type PreviewView = {
  id: string;
  title: string;
  payload: Record<string, unknown>;
};

export function normalizePreviewViews(views: PreviewView[]): PreviewView[] {
  return [...views].sort((a, b) => a.id.localeCompare(b.id));
}
