import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        outDir: 'docs',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                connect4: resolve(__dirname, 'games/connect4/index.html'),
                testGame: resolve(__dirname, 'games/test-game/index.html'),
                minimalTemplate: resolve(__dirname, 'games/minimal-template/index.html'),
            },
        },
    },
});
