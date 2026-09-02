import {defineConfig} from 'vite';
export default defineConfig({root:'source',publicDir:'../public',base:'./',build:{outDir:'../dist',emptyOutDir:true,sourcemap:false}});
