import { useEffect, useMemo, useState } from 'react';

import { Editor } from './components/editor';
import { loadConfig, type ConfigResponse } from './lib/api';
import { editorPath, editorUUIDFromPath } from './lib/editor-path';

function createEditorKey(): string {
  return crypto.randomUUID();
}

export default function App() {
  const initialKey = useMemo(
    () => editorUUIDFromPath(window.location.pathname) || createEditorKey(),
    [],
  );
  const [editorKey, setEditorKey] = useState(initialKey);
  const [data, setData] = useState<ConfigResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editorUUIDFromPath(window.location.pathname)) {
      window.history.replaceState(null, '', editorPath(editorKey));
    }
    let cancelled = false;
    loadConfig(editorKey)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : '无法读取配置');
      });
    return () => {
      cancelled = true;
    };
  }, [editorKey]);

  function createNew() {
    const nextKey = createEditorKey();
    window.history.pushState(null, '', editorPath(nextKey));
    setData(null);
    setError('');
    setEditorKey(nextKey);
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="space-y-3 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={createNew}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            新增
          </button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <span className="text-sm text-gray-500">加载中…</span>
      </main>
    );
  }

  return (
    <Editor
      key={`${editorKey}:${JSON.stringify(data.config)}`}
      adminToken={editorKey}
      initial={data}
      onReload={async () => {
        const response = await loadConfig(editorKey);
        setData(response);
      }}
      onCreate={createNew}
    />
  );
}
