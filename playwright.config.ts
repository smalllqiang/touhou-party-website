import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

// 开发机上有系统 Chromium 就直接用，避免额外下载浏览器；
// 没有的话自动回退到 Playwright 自带的 chromium（需 `npx playwright install chromium`）。
const systemChromium = process.env.CHROMIUM_PATH
  || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath: systemChromium,
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
