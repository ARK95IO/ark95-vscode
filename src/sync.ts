import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AuthService } from './auth';
import { API_URL } from './config';
import ignore from 'ignore';

// Client-side pre-filtering for performance only (avoid sending GBs of useless data).
// Security filtering (sensitive files, path traversal, size limits) is enforced server-side.
const SKIP_DIRS = new Set([
    'node_modules', '.git', '__pycache__', '.venv', 'venv', 'vendor',
    'dist', 'build', '.next', 'target', 'coverage', '.cache',
    '.turbo', '.vercel', '.netlify',
]);

// Extensions worth sending — the backend has its own allowlist and will discard the rest.
const CODE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.kt',
    '.rb', '.php', '.cs', '.swift', '.scala', '.vue', '.svelte',
    '.yaml', '.yml', '.toml', '.json', '.prisma', '.graphql', '.gql',
    '.proto', '.sql', '.tf', '.hcl', '.sh',
]);
const SPECIAL_FILES = new Set(['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'Makefile']);

// Skip obviously non-code files to save bandwidth (not a security measure)
const SKIP_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
    '.mp4', '.mp3', '.wav', '.ogg', '.webm', '.mov',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.exe', '.dll', '.so', '.dylib', '.bin',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.lock', '.map',
]);

export interface SyncLimits {
    monthlyUsed: number;
    monthlyLimit: number;
    dailyUsed: number;
    dailyLimit: number;
    cooldownActive: boolean;
    nextAllowedAt: string | null;
    totalUsed: number;
    totalLimit: number;
    diagramCount: number;
    diagramLimit: number;
    isFree: boolean;
}

export class SyncService {
    constructor(private auth: AuthService) {}

    async getLimits(): Promise<SyncLimits | null> {
        const token = this.auth.getToken();
        if (!token) return null;

        try {
            const res = await fetch(`${API_URL}/txt-sync/limits`, {
                headers: { 'Cookie': `token=${token}` },
            });
            if (!res.ok) return null;
            return await res.json() as SyncLimits;
        } catch {
            return null;
        }
    }

    async generateDiagram(): Promise<{ syncId: string } | { error: string }> {
        const token = this.auth.getToken();
        if (!token) return { error: 'Not logged in' };

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return { error: 'No workspace folder open' };
        }

        const rootPath = workspaceFolder.uri.fsPath;

        // Collect code files
        const files = await this.collectFiles(rootPath);
        if (files.length === 0) {
            return { error: 'No code files found in workspace' };
        }

        // Build a description from the code for the AI
        const description = this.buildDescription(rootPath, files);

        try {
            const res = await fetch(`${API_URL}/vscode-sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `token=${token}`,
                },
                body: JSON.stringify({
                    description,
                    files: files.map(f => ({
                        path: f.relativePath,
                        content: f.content,
                    })),
                }),
            });

            if (!res.ok) {
                const data = await res.json() as { message?: string };
                return { error: data.message || `Sync failed (${res.status})` };
            }

            const data = await res.json() as { syncId: string };
            return data;
        } catch (err: any) {
            return { error: err.message || 'Network error' };
        }
    }

    async pollSyncStatus(syncId: string, onProgress: (status: string) => void): Promise<{ diagramId: string } | { error: string }> {
        const token = this.auth.getToken();
        if (!token) return { error: 'Not logged in' };

        const maxAttempts = 120; // 2 minutes max
        for (let i = 0; i < maxAttempts; i++) {
            await sleep(1000);
            try {
                const res = await fetch(`${API_URL}/vscode-sync/${syncId}`, {
                    headers: { 'Cookie': `token=${token}` },
                });
                if (!res.ok) return { error: 'Failed to check sync status' };

                const data = await res.json() as { status: string; diagramId?: string; errorMessage?: string };
                onProgress(data.status);

                if (data.status === 'completed' && data.diagramId) {
                    return { diagramId: data.diagramId };
                }
                if (data.status === 'failed') {
                    return { error: data.errorMessage || 'Sync failed' };
                }
            } catch {
                // Continue polling
            }
        }
        return { error: 'Sync timed out' };
    }

    async fetchDiagramGraph(diagramId: string): Promise<any | null> {
        const token = this.auth.getToken();
        if (!token) return null;

        try {
            const res = await fetch(`${API_URL}/diagrams/${diagramId}/graph`, {
                headers: { 'Cookie': `token=${token}` },
            });
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    }

    async fetchDiagrams(): Promise<Array<{ id: string; name: string; createdAt: string }>> {
        const token = this.auth.getToken();
        if (!token) return [];

        try {
            const res = await fetch(`${API_URL}/diagrams`, {
                headers: { 'Cookie': `token=${token}` },
            });
            if (!res.ok) return [];
            return await res.json() as Array<{ id: string; name: string; createdAt: string }>;
        } catch {
            return [];
        }
    }

    private async collectFiles(rootPath: string): Promise<Array<{ relativePath: string; content: string }>> {
        const ig = ignore();

        // Load .gitignore if exists
        const gitignorePath = path.join(rootPath, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
            ig.add(gitignoreContent);
        }

        const files: Array<{ relativePath: string; content: string }> = [];

        const walk = (dir: string) => {
            let entries: fs.Dirent[];
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
                return;
            }

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(rootPath, fullPath);

                // Skip massive dirs that are never useful
                if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;

                if (ig.ignores(relativePath)) continue;

                if (entry.isDirectory()) {
                    walk(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();

                    // Skip obvious non-code files (perf, not security)
                    if (SKIP_EXTENSIONS.has(ext)) continue;

                    // Only send known code extensions or special filenames
                    if (!CODE_EXTENSIONS.has(ext) && !SPECIAL_FILES.has(entry.name)) continue;

                    try {
                        const content = fs.readFileSync(fullPath, 'utf-8');
                        files.push({ relativePath, content });
                    } catch {
                        // Skip unreadable files (binary, permissions, etc.)
                    }
                }
            }
        };

        walk(rootPath);
        return files;
    }

    private buildDescription(rootPath: string, files: Array<{ relativePath: string }>): string {
        const projectName = path.basename(rootPath);
        const dirs = new Set(files.map(f => f.relativePath.split(path.sep)[0]));
        return `VS Code project "${projectName}" with directories: ${[...dirs].join(', ')}. Analyze the code files to generate an architecture diagram.`;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
