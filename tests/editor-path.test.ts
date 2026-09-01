import { describe, expect, it } from 'vitest';

import {
  editorPath,
  editorUUIDFromPath,
  isEditorUUID,
} from '../src/lib/editor-path';

const uuid = '6f0d4a82-3c64-4eb6-9b18-2c7e94f160d5';

describe('editor UUID path', () => {
  it('accepts one UUID path segment', () => {
    expect(isEditorUUID(uuid)).toBe(true);
    expect(editorUUIDFromPath(`/${uuid}`)).toBe(uuid);
    expect(editorPath(uuid)).toBe(`/${uuid}`);
  });

  it('rejects root, nested paths, and arbitrary tokens', () => {
    expect(editorUUIDFromPath('/')).toBe('');
    expect(editorUUIDFromPath(`/admin/${uuid}`)).toBe('');
    expect(editorUUIDFromPath('/overlay-local-admin')).toBe('');
  });
});
