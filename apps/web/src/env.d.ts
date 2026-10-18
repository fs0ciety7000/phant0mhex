interface ImportMetaEnv {
  readonly PB_INTERNAL_URL?: string;
  readonly PUBLIC_PB_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
