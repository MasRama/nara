export function getCSRFToken(): string | undefined {
  return document.cookie.match(/csrf_token=([^;]+)/)?.[1];
}
