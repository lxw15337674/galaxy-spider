import fs from 'fs';
import path from 'path';

const DEFAULT_STORAGE_STATE_PATH = 'weibo.storage.json';
const DEFAULT_GIST_FILENAME = 'weibo.storage.json';

async function fetchGistStorageState(): Promise<string | undefined> {
    const gistId = process.env.GIST_ID;
    const token = process.env.GIST_TOKEN || process.env.GITHUB_TOKEN;
    if (!gistId || !token) {
        return undefined;
    }

    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }
    });

    if (!response.ok) {
        throw new Error(`GitHub Gist 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    const files = data.files || {};
    const preferredName = process.env.GIST_STORAGE_STATE_FILENAME || DEFAULT_GIST_FILENAME;
    const file = files[preferredName] || Object.values(files)[0];
    if (!file) {
        throw new Error('Gist 中未找到 storageState 文件');
    }

    if (file.truncated && file.raw_url) {
        const rawResponse = await fetch(file.raw_url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json'
            }
        });
        if (!rawResponse.ok) {
            throw new Error(`Gist raw 文件拉取失败: ${rawResponse.status} ${rawResponse.statusText}`);
        }
        return await rawResponse.text();
    }

    return file.content as string | undefined;
}

export async function resolveStorageStatePath(): Promise<string | undefined> {
    const envPath = process.env.STORAGE_STATE_PATH || DEFAULT_STORAGE_STATE_PATH;
    const resolvedPath = path.resolve(envPath);

    if (fs.existsSync(resolvedPath)) {
        return resolvedPath;
    }

    const content = await fetchGistStorageState();
    if (!content) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(content);
        const isStorageState =
            parsed &&
            typeof parsed === 'object' &&
            Array.isArray(parsed.cookies) &&
            Array.isArray(parsed.origins);
        if (!isStorageState) {
            return undefined;
        }
    } catch {
        return undefined;
    }

    fs.writeFileSync(resolvedPath, content, 'utf8');
    return resolvedPath;
}

export async function updateStorageStateToGist(storageStatePath?: string): Promise<void> {
    const gistId = process.env.GIST_ID;
    const token = process.env.GIST_TOKEN || process.env.GITHUB_TOKEN;
    if (!gistId || !token) {
        throw new Error('缺少必要的环境变量: GIST_ID 与 GIST_TOKEN/GITHUB_TOKEN');
    }

    const resolvedPath = path.resolve(storageStatePath || DEFAULT_STORAGE_STATE_PATH);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`storageState 文件不存在: ${resolvedPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    let parsed: any;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('storageState 文件不是有效的 JSON');
    }

    const isStorageState =
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray(parsed.cookies) &&
        Array.isArray(parsed.origins);
    if (!isStorageState) {
        throw new Error('storageState 文件格式不正确（缺少 cookies/origins）');
    }

    const filename = process.env.GIST_STORAGE_STATE_FILENAME || DEFAULT_GIST_FILENAME;
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            files: {
                [filename]: {
                    content
                }
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gist 更新失败: ${response.status} ${errorText}`);
    }
}
