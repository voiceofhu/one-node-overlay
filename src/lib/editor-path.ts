const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isEditorUUID(value: string): boolean {
  return uuidPattern.test(value.trim());
}

export function editorUUIDFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 1) return '';
  const candidate = decodeURIComponent(segments[0]);
  return isEditorUUID(candidate) ? candidate : '';
}

export function editorPath(uuid: string): string {
  return `/${encodeURIComponent(uuid.trim())}`;
}
