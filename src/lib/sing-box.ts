export function singBoxImportUrl(subscriptionUrl: string): string {
  return `sing-box://import-remote-profile?url=${encodeURIComponent(subscriptionUrl)}#${encodeURIComponent('Overlay')}`;
}
