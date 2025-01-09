interface Task<T> {
    execute: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
}

export class TaskQueue {
    private queue: Task<any>[] = [];
    private running = 0;
    private readonly concurrency: number;

    constructor(concurrency = 3) {
        this.concurrency = concurrency;
    }

    async add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({
                execute: task,
                resolve,
                reject
            });
            this.processNext();
        });
    }

    private async processNext() {
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }

        this.running++;
        const task = this.queue.shift()!;

        try {
            const result = await task.execute();
            task.resolve(result);
        } catch (error) {
            task.reject(error);
        } finally {
            this.running--;
            this.processNext();
        }
    }
}