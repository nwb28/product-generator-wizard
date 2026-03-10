# SBOM Process

## Purpose
Publish reproducible software bill of materials artifacts for each release candidate and on a scheduled cadence.

## Local Generation
```bash
npm run sbom:generate
```

Output:
- `.tmp/sbom.cdx.json` (CycloneDX JSON)

## CI Generation
Workflow: `.github/workflows/sbom.yml`

Triggers:
1. Weekly scheduled run.
2. Manual `workflow_dispatch`.
3. Changes to lockfiles, package manifests, or workflow definition.

## Controls
1. Workflow runs `npm ci` before generation to ensure lockfile-resolved dependency graph.
2. SBOM JSON is parsed as a validity check before upload.
3. Artifact retention is set to 30 days for compliance evidence handoff.

## Release Usage
1. Attach the SBOM artifact to release evidence packages.
2. Pair with vulnerability gate output from `security-scan` workflow.
3. Store long-term release evidence in enterprise artifact retention storage.
