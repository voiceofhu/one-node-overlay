import { Check, Clipboard, Plus, RefreshCw, Save } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';

import { saveConfig, type ConfigResponse } from '../lib/api';
import {
  formatZodError,
  overlayConfigSchema,
  type OverlayConfig,
} from '../lib/config';

const JsonEditor = lazy(() =>
  import('./json-editor').then((module) => ({ default: module.JsonEditor })),
);

interface EditorProps {
  adminToken: string;
  initial: ConfigResponse;
  onReload: () => Promise<void>;
  onCreate: () => void;
}

interface DraftState {
  sourceUrl: string;
  overlayText: string;
}

function draftFromConfig(config: OverlayConfig): DraftState {
  return {
    sourceUrl: config.sourceUrl,
    overlayText:
      Object.keys(config.overlay).length === 0 ? '' : JSON.stringify(config.overlay, null, 2),
  };
}

function parseDraft(draft: DraftState): OverlayConfig {
  let overlay: unknown;
  try {
    overlay = draft.overlayText.trim() === '' ? {} : (JSON.parse(draft.overlayText) as unknown);
  } catch {
    throw new Error('用户 JSON 格式无效');
  }
  const parsed = overlayConfigSchema.safeParse({
    sourceUrl: draft.sourceUrl.trim(),
    overlay,
  });
  if (!parsed.success) throw new Error(formatZodError(parsed.error));
  return parsed.data;
}

const secondaryButton =
  'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50';

export function Editor({
  adminToken,
  initial,
  onReload,
  onCreate,
}: EditorProps) {
  const [draft, setDraft] = useState(() => draftFromConfig(initial.config));
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  async function save() {
    setError('');
    setNotice('');
    let config: OverlayConfig;
    try {
      config = parseDraft(draft);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '配置校验失败');
      return;
    }
    setSaving(true);
    try {
      const response = await saveConfig(adminToken, config);
      setDraft(draftFromConfig(response.config));
      setNotice('已保存');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function reload() {
    setReloading(true);
    setError('');
    setNotice('');
    try {
      await onReload();
    } catch (reloadError) {
      setError(reloadError instanceof Error ? reloadError.message : '重新载入失败');
    } finally {
      setReloading(false);
    }
  }

  async function copySubscription() {
    try {
      await navigator.clipboard.writeText(initial.subscriptionUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('复制失败，请手动复制订阅链接');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <h1 className="font-semibold text-gray-950">Overlay</h1>
          <div className="flex items-center gap-2">
            <button
              className={secondaryButton}
              type="button"
              onClick={reload}
              disabled={reloading}
              aria-label="重新载入"
              title="重新载入"
            >
              <RefreshCw
                size={15}
                className={reloading ? 'animate-spin' : ''}
                aria-hidden="true"
              />
            </button>
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
              type="button"
              onClick={save}
              disabled={saving}
            >
              <Save size={15} aria-hidden="true" />
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              type="button"
              onClick={onCreate}
              aria-label="新增"
              title="新增"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-700" role="alert">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
            {notice}
          </div>
        ) : null}

        <section className="rounded-lg bg-white p-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="subscription-url">
            订阅链接
          </label>
          <div className="flex gap-2">
            <input
              id="subscription-url"
              readOnly
              value={initial.subscriptionUrl}
              className="h-10 min-w-0 flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 font-mono text-xs text-gray-700"
            />
            <button className={secondaryButton} type="button" onClick={copySubscription}>
              {copied ? <Check size={15} /> : <Clipboard size={15} />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        </section>

        <section className="rounded-lg bg-white p-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="source-url">
            原始订阅 URL
          </label>
          <input
            id="source-url"
            type="url"
            spellCheck={false}
            value={draft.sourceUrl}
            onChange={(event) =>
              setDraft((current) => ({ ...current, sourceUrl: event.target.value }))
            }
            className="h-10 w-full rounded-md border border-gray-300 px-3 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </section>

        <section className="rounded-lg bg-white p-4">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-700">
              用户 JSON
            </span>
            <span className="text-xs text-gray-400">优先于原始配置</span>
          </div>
          <Suspense
            fallback={<div className="h-[36rem] animate-pulse rounded-md bg-gray-100" />}
          >
            <JsonEditor
              value={draft.overlayText}
              onChange={(value) =>
                setDraft((current) => ({ ...current, overlayText: value }))
              }
            />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
