import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig(({ mode }) => {
    const host: string | undefined = process.env.TAURI_DEV_HOST;

    return {
        plugins: [sveltekit()],

        server: {
            host: host ?? false,
            port: 5173,
            strictPort: true,
            hmr: host
                ? {
                      protocol: 'ws',
                      host: host,
                      port: 5174
                  }
                : undefined
        }
    };
});