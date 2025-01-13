export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const MAX_RETRY_ATTEMPTS = 3;



export async function retryRequest<T>(fn: () => Promise<T>, retryCount = MAX_RETRY_ATTEMPTS): Promise<T> {
    for (let i = 0; i < retryCount; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retryCount - 1) throw error;
            await sleep(1000 * (i + 1));
        }
    }
    throw new Error('Retry failed');
}