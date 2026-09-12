import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',timeout:60000,expect:{timeout:15000},use:{baseURL:process.env.QA_BASE_URL||'http://127.0.0.1:3000',viewport:{width:1440,height:1000},launchOptions:{executablePath:process.env.CHROMIUM_PATH,chromiumSandbox:false}},reporter:'list'});
