/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_CHATBOTKIT_API_KEY: string
  readonly VITE_CHATBOTKIT_USER_ID: string
  readonly VITE_COMPANY_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
