/**
 * 应用配置
 */

export type RunMode = 'test' | 'dev' | 'production';

export const config = {
    runMode: (process.env.RUN_MODE || 'production') as RunMode,
    
    // Cookie 配置
    // 设置为 true 时强制使用硬编码的 Cookie，忽略 Gist
    useHardcodedCookie: process.env.USE_HARDCODED_COOKIE === 'true' || true, // 默认使用硬编码
    
    // 派生配置 - 模式检查
    get isTest() { 
        return this.runMode === 'test'; 
    },
    
    get isDev() { 
        return this.runMode === 'dev'; 
    },
    
    get isProduction() { 
        return this.runMode === 'production'; 
    },
    
    // 功能开关
    get shouldWriteDB() { 
        return this.runMode === 'production'; 
    },
    
    get useTestData() { 
        return this.runMode === 'test'; 
    },
    
    // 日志前缀
    get logPrefix() {
        switch (this.runMode) {
            case 'test': return '[TEST]';
            case 'dev': return '[DEV]';
            default: return '';
        }
    }
};
