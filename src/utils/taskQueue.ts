export class TaskQueue {
    private concurrency: number;
    private running: number;
    private queue: (() => Promise<any>)[];

    constructor(concurrency: number) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    async add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.process();
        });
    }

    private async process(): Promise<void> {
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }

        this.running++;
        const task = this.queue.shift();
        
        if (task) {
            try {
                await task();
            } finally {
                this.running--;
                this.process();
            }
        }
    }
} 