import { defineConfig, globalIgnores } from 'eslint/config';
import next from 'eslint-config-next/core-web-vitals';
import ts from 'eslint-config-next/typescript';
// The home logo intentionally starts a fresh document and cancels active demo streams.
export default defineConfig([...next, ...ts, {rules:{'@next/next/no-img-element':'off','@next/next/no-html-link-for-pages':'off'}}, globalIgnores(['.next/**','convex/_generated/**'])]);
