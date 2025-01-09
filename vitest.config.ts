import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 全局测试超时时间设置为 6 分钟
    testTimeout: 360000,
  },
}) 