import { createHash } from 'node:crypto';

export type PreviewArtifactFile = {
  path: string;
  content: string;
};

export type PreviewArtifactPackage = {
  files: PreviewArtifactFile[];
  deterministicHash: string;
};

export function generateDeterministicPreviewArtifacts(previewSession: Record<string, unknown>): PreviewArtifactPackage {
  const views = ((previewSession.views as Array<{ id: string; title: string; payload: unknown }> | undefined) ?? [])
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      payload: entry.payload
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const files: PreviewArtifactFile[] = views.map((view) => ({
    path: `preview/views/${view.id}.json`,
    content: stableStringify({ id: view.id, title: view.title, payload: view.payload })
  }));

  files.push({
    path: 'preview/metadata/session.json',
    content: stableStringify({
      sessionId: previewSession.sessionId ?? 'unknown-session',
      tenantId: previewSession.tenantId ?? 'unknown-tenant',
      productId: previewSession.productId ?? 'unknown-product'
    })
  });

  files.sort((a, b) => a.path.localeCompare(b.path));

  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file.path);
    hash.update('\n');
    hash.update(file.content);
    hash.update('\n');
  }

  return {
    files,
    deterministicHash: hash.digest('hex')
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}
