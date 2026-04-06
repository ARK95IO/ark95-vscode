import * as vscode from 'vscode';
import { AuthService } from './auth';
import { SyncService } from './sync';
import { Ark95FileManager } from './ark95file';
import { SidebarProvider } from './sidebar';
import { FRONTEND_URL } from './config';

export function activate(context: vscode.ExtensionContext) {
    const auth = new AuthService(context);
    const syncService = new SyncService(auth);
    const ark95File = new Ark95FileManager();
    const sidebarProvider = new SidebarProvider(context.extensionUri, auth, syncService);

    // Register sidebar
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider),
    );

    // URI handler: vscode://ark95.ark95/auth?token=xxx
    context.subscriptions.push(
        vscode.window.registerUriHandler({
            async handleUri(uri: vscode.Uri) {
                const params = new URLSearchParams(uri.query);
                const token = params.get('token');
                if (uri.path === '/auth' && token) {
                    await auth.handleAuthCallback(token);
                    sidebarProvider.refresh();
                }
            },
        }),
    );

    // Init auth (load saved token)
    auth.init();

    // Command: Login
    context.subscriptions.push(
        vscode.commands.registerCommand('ark95.login', () => auth.loginViaBrowser()),
    );

    // Command: Logout
    context.subscriptions.push(
        vscode.commands.registerCommand('ark95.logout', () => auth.logout()),
    );

    // Command: Generate Diagram
    context.subscriptions.push(
        vscode.commands.registerCommand('ark95.generateDiagram', async () => {
            if (!auth.isLoggedIn()) {
                const action = await vscode.window.showWarningMessage(
                    'You need to login to Ark95 first.',
                    'Login',
                );
                if (action === 'Login') {
                    await auth.loginViaBrowser();
                }
                return;
            }

            // Fresh limits check — catches diagrams created via dashboard
            const limits = await syncService.getLimits();
            if (limits) {
                sidebarProvider.refreshLimits();
                sidebarProvider.refreshDiagrams();
                if (limits.diagramLimit !== -1 && limits.diagramCount >= limits.diagramLimit) {
                    vscode.window.showWarningMessage(
                        `Diagram limit reached (${limits.diagramCount}/${limits.diagramLimit}).${limits.isFree ? ' Upgrade to Pro for more diagrams.' : ''}`,
                    );
                    return;
                }
            }

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Ark95',
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({ message: 'Reading workspace files...' });

                    const result = await syncService.generateDiagram();
                    if ('error' in result) {
                        vscode.window.showErrorMessage(`Ark95: ${result.error}`);
                        return;
                    }

                    progress.report({ message: 'Generating architecture diagram...' });

                    const pollResult = await syncService.pollSyncStatus(result.syncId, (status) => {
                        const statusMessages: Record<string, string> = {
                            pending: 'Queued...',
                            analyzing: 'AI is analyzing your code...',
                            generating: 'Generating diagram...',
                        };
                        progress.report({ message: statusMessages[status] || status });
                    });

                    if ('error' in pollResult) {
                        vscode.window.showErrorMessage(`Ark95: ${pollResult.error}`);
                        return;
                    }

                    progress.report({ message: 'Saving .ark95 file...' });

                    // Fetch the full diagram graph
                    const graph = await syncService.fetchDiagramGraph(pollResult.diagramId);
                    if (graph) {
                        ark95File.write(pollResult.diagramId, graph);
                    }

                    sidebarProvider.refresh();
                    await sidebarProvider.refreshLimits();
                    await sidebarProvider.refreshDiagrams();

                    const action = await vscode.window.showInformationMessage(
                        'Architecture diagram generated! .ark95 file updated.',
                        'View on Ark95',
                        'Open File',
                    );

                    if (action === 'View on Ark95') {
                        vscode.env.openExternal(
                            vscode.Uri.parse(`${FRONTEND_URL}/dashboard?diagram=${pollResult.diagramId}`),
                        );
                    } else if (action === 'Open File') {
                        const filePath = ark95File.getFilePath();
                        if (filePath) {
                            const doc = await vscode.workspace.openTextDocument(filePath);
                            await vscode.window.showTextDocument(doc);
                        }
                    }
                },
            );
        }),
    );

    // Command: Open diagram on web
    context.subscriptions.push(
        vscode.commands.registerCommand('ark95.openDiagram', async () => {
            const diagramId = ark95File.getDiagramId();
            if (diagramId) {
                vscode.env.openExternal(
                    vscode.Uri.parse(`${FRONTEND_URL}/dashboard?diagram=${diagramId}`),
                );
            } else {
                vscode.window.showWarningMessage('No .ark95 file found. Generate a diagram first.');
            }
        }),
    );
}

export function deactivate() {}
