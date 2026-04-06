import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FRONTEND_URL } from './config';

export interface Ark95FileData {
    version: string;
    projectName: string;
    diagramId: string;
    diagramUrl: string;
    generatedAt: string;
    nodes: Array<{
        id: string;
        label: string;
        type: string;
        tech?: string;
        file_origin?: string;
    }>;
    edges: Array<{
        source: string;
        target: string;
        subtype: string;
        protocol?: string;
    }>;
}

export class Ark95FileManager {
    getFilePath(): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return null;
        return path.join(workspaceFolder.uri.fsPath, '.ark95');
    }

    exists(): boolean {
        const filePath = this.getFilePath();
        if (!filePath) return false;
        return fs.existsSync(filePath);
    }

    read(): Ark95FileData | null {
        const filePath = this.getFilePath();
        if (!filePath || !fs.existsSync(filePath)) return null;
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content) as Ark95FileData;
        } catch {
            return null;
        }
    }

    write(diagramId: string, graph: any) {
        const filePath = this.getFilePath();
        if (!filePath) return;

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const projectName = workspaceFolder ? path.basename(workspaceFolder.uri.fsPath) : 'unknown';

        // Build a lookup map: node DB id → node label
        const nodeNameMap = new Map<string, string>();
        for (const n of (graph.nodes || [])) {
            nodeNameMap.set(n.id, n.data?.label || n.id);
        }

        const data: Ark95FileData = {
            version: '1.0.0',
            projectName,
            diagramId,
            diagramUrl: `${FRONTEND_URL}/dashboard?diagram=${diagramId}`,
            generatedAt: new Date().toISOString(),
            nodes: (graph.nodes || []).map((n: any) => ({
                id: n.data?.metadata?.ark95_id || n.id,
                label: n.data?.label || n.id,
                type: n.data?.entityType || n.type,
                tech: n.data?.subtype || undefined,
                file_origin: n.data?.metadata?.file_origin || undefined,
            })),
            edges: (graph.edges || []).map((e: any) => ({
                source: nodeNameMap.get(e.source) || e.source,
                target: nodeNameMap.get(e.target) || e.target,
                subtype: e.data?.subtype || 'unknown',
                protocol: e.data?.protocol || undefined,
            })),
        };

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    getDiagramId(): string | null {
        const data = this.read();
        return data?.diagramId || null;
    }
}
