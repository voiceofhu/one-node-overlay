import { describe, expect, it } from 'vitest';

import { singBoxImportUrl } from '../src/lib/sing-box';

describe('singBoxImportUrl', () => {
  it('encodes the remote profile URL for the sing-box import scheme', () => {
    expect(
      singBoxImportUrl('https://overlay.example/sub/example?id=1&format=json'),
    ).toBe(
      'sing-box://import-remote-profile?url=https%3A%2F%2Foverlay.example%2Fsub%2Fexample%3Fid%3D1%26format%3Djson#Overlay',
    );
  });
});
