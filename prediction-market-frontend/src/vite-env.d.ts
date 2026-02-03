/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string
    readonly VITE_SOLANA_RPC_URL: string
    readonly VITE_PROGRAM_ID: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

declare global {
    const Buffer: typeof import('buffer').Buffer
}

export { }
