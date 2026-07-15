/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_CURRENCY?: string;
  readonly VITE_TIME_ZONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
