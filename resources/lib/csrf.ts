export function getCSRFToken(): string | undefined {
  return document.cookie.match(/csrf_token=([^;]+)/)?.[1];
}

export function configureAxiosCSRF(axiosInstance: { interceptors: { request: { use: (fn: (config: any) => any) => void } } }): void {
  axiosInstance.interceptors.request.use((config: any) => {
    const token = getCSRFToken();
    if (token && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-Token'] = token;
    }
    return config;
  });
}
