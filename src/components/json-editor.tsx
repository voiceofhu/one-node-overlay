import { json, jsonParseLinter } from '@codemirror/lang-json';
import { lintGutter, linter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import { useMemo } from 'react';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const parseJson = jsonParseLinter();

export function JsonEditor({ value, onChange }: JsonEditorProps) {
  const extensions = useMemo(
    () => [
      json(),
      linter((view) =>
        view.state.doc.toString().trim() === '' ? [] : parseJson(view),
      ),
      lintGutter(),
      EditorView.contentAttributes.of({
        'aria-label': '用户 JSON',
        spellcheck: 'false',
      }),
      EditorView.theme({
        '&': {
          fontSize: '13px',
        },
        '.cm-scroller': {
          fontFamily:
            'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace',
        },
        '.cm-content': {
          paddingTop: '10px',
          paddingBottom: '10px',
        },
        '.cm-gutters': {
          backgroundColor: '#f6f8fa',
          borderRight: '1px solid #d0d7de',
        },
      }),
    ],
    [],
  );

  return (
    <div className="overflow-hidden rounded-md border border-gray-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
      <CodeMirror
        value={value}
        height="36rem"
        theme={githubLight}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          history: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
      />
    </div>
  );
}
