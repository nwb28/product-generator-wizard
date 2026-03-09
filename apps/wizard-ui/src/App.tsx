import { useEffect, useMemo, useState } from 'react';
import { checkWizardEntryAuthorization, generateArtifactsApi, validateIntakeApi } from './api.js';
import { buildDownloadFileName, toDownloadBlob } from './download.js';
import { applyPrefill, parsePrefill } from './prefill.js';
import type { Diagnostic, GenerateResponse, ValidateResponse } from './types.js';

const initialIntake = {
  schemaVersion: '1.0.0'
};

export function App() {
  const [intakeText, setIntakeText] = useState(() => {
    const prefill = parsePrefill(window.location.search);
    const merged = applyPrefill(initialIntake, prefill);
    return JSON.stringify(merged, null, 2);
  });
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [generation, setGeneration] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const parsed = useMemo(() => {
    try {
      return JSON.parse(intakeText) as unknown;
    } catch {
      return null;
    }
  }, [intakeText]);

  useEffect(() => {
    void checkWizardEntryAuthorization().then((ok) => {
      setAuthorized(ok);
      if (!ok) {
        setError('You are not authorized to use the Product Generator Wizard.');
      }
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!parsed) {
        setValidation(null);
        setError('Intake JSON is invalid.');
        return;
      }

      setError('');
      const response = await validateIntakeApi(parsed);
      setValidation(response);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [parsed]);

  async function onGenerate() {
    if (!authorized) {
      setError('You are not authorized to generate artifacts.');
      return;
    }

    if (!parsed) {
      setError('Intake JSON is invalid.');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const output = await generateArtifactsApi(parsed);
      setGeneration(output);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  }

  function onDownload() {
    if (!generation || !parsed || typeof parsed !== 'object') {
      return;
    }

    const maybeProduct = (parsed as { product?: { id?: string } }).product;
    const fileName = buildDownloadFileName(maybeProduct?.id ?? 'product');
    const blob = toDownloadBlob(generation);
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <h1>Product Generator Wizard</h1>

      <section>
        <h2>Intake</h2>
        <textarea
          rows={24}
          cols={120}
          value={intakeText}
          onChange={(event) => setIntakeText(event.target.value)}
        />
      </section>

      <section>
        <h2>Validation</h2>
        <p>{validation?.summary ?? 'No validation result yet.'}</p>
        <Diagnostics diagnostics={validation?.diagnostics ?? []} />
      </section>

      <section>
        <button type='button' onClick={() => void onGenerate()} disabled={isGenerating || !validation?.valid}>
          {isGenerating ? 'Generating...' : 'Generate Artifacts'}
        </button>
        <button type='button' onClick={onDownload} disabled={!generation}>
          Download Package
        </button>
      </section>

      {generation ? (
        <section>
          <h2>Generation Output</h2>
          <p>Deterministic Hash: {generation.deterministicHash}</p>
          <ul>
            {generation.files.map((file) => (
              <li key={file.path}>{file.path}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? <p role='alert'>{error}</p> : null}
    </main>
  );
}

function Diagnostics({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (diagnostics.length === 0) {
    return <p>No diagnostics.</p>;
  }

  return (
    <ul>
      {diagnostics.map((item) => (
        <li key={`${item.code}:${item.path}`}>
          [{item.severity.toUpperCase()}] {item.code} {item.path} - {item.message}
        </li>
      ))}
    </ul>
  );
}
