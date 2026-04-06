import * as vscode from 'vscode';
import { AuthService } from './auth';
import { SyncService } from './sync';
import { FRONTEND_URL } from './config';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ark95.sidebar';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly auth: AuthService,
        private readonly syncService: SyncService,
    ) {
        this.auth.onDidChangeAuth(() => this.refresh());
    }

    resolveWebviewView(view: vscode.WebviewView) {
        this._view = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = this.getHtml();

        view.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.command) {
                case 'login':
                    await this.auth.loginViaBrowser();
                    break;
                case 'logout':
                    await this.auth.logout();
                    break;
                case 'generate':
                    await vscode.commands.executeCommand('ark95.generateDiagram');
                    break;
                case 'openWeb':
                    await vscode.env.openExternal(vscode.Uri.parse(`${FRONTEND_URL}/dashboard`));
                    break;
                case 'openDiagram':
                    if (msg.diagramId) {
                        await vscode.env.openExternal(vscode.Uri.parse(`${FRONTEND_URL}/dashboard?diagram=${msg.diagramId}`));
                    }
                    break;
                case 'refreshLimits':
                    await this.refreshLimits();
                    await this.refreshDiagrams();
                    break;
            }
        });
    }

    refresh() {
        if (this._view) {
            this._view.webview.html = this.getHtml();
        }
    }

    async refreshLimits() {
        if (!this.auth.isLoggedIn()) return;
        const limits = await this.syncService.getLimits();
        if (limits && this._view) {
            this._view.webview.postMessage({ command: 'limitsUpdate', limits });
        }
    }

    async refreshDiagrams() {
        if (!this.auth.isLoggedIn()) return;
        const diagrams = await this.syncService.fetchDiagrams();
        if (this._view) {
            this._view.webview.postMessage({ command: 'diagramsUpdate', diagrams });
        }
    }

    private getHtml(): string {
        const user = this.auth.getUser();
        const isLoggedIn = this.auth.isLoggedIn();

        const logoUri = this._view!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'icon.png'),
        );

        return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: var(--vscode-font-family);
        color: #e2e8f0;
        padding: 0;
        font-size: 13px;
        background: #0c0c1d;
    }
    .header {
        background: linear-gradient(135deg, #0c0c1d 0%, #1a1040 100%);
        padding: 20px 16px 16px;
        text-align: center;
        border-bottom: 1px solid rgba(139, 92, 246, 0.2);
    }
    .header img { width: 40px; height: auto; margin-bottom: 6px; }
    .header-title {
        font-size: 14px;
        font-weight: 700;
        color: #fff;
        letter-spacing: 0.5px;
    }
    .header-subtitle {
        font-size: 11px;
        color: #8b5cf6;
        margin-top: 2px;
    }
    .content { padding: 16px; }
    .section { margin-bottom: 16px; }
    .user-card {
        background: rgba(139, 92, 246, 0.08);
        border: 1px solid rgba(139, 92, 246, 0.2);
        border-radius: 8px;
        padding: 12px;
    }
    .user-name { font-weight: 600; font-size: 13px; color: #fff; }
    .user-email { color: #94a3b8; font-size: 11px; margin-top: 2px; }
    .plan-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        margin-top: 6px;
        letter-spacing: 0.5px;
    }
    .plan-free { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.3); }
    .plan-pro { background: rgba(139, 92, 246, 0.15); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.3); }
    .btn {
        display: block;
        width: 100%;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        margin-bottom: 8px;
        text-align: center;
        transition: all 0.2s;
    }
    .btn-primary {
        background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
        color: #fff;
        box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
    }
    .btn-primary:hover {
        background: linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    }
    .btn-secondary {
        background: rgba(139, 92, 246, 0.1);
        color: #a78bfa;
        border: 1px solid rgba(139, 92, 246, 0.25);
    }
    .btn-secondary:hover {
        background: rgba(139, 92, 246, 0.18);
    }
    .btn-logout {
        background: transparent;
        color: #64748b;
        font-size: 12px;
        padding: 6px 12px;
    }
    .btn-logout:hover { color: #ef4444; }
    .card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        padding: 12px;
    }
    .limit-row {
        display: flex;
        justify-content: space-between;
        padding: 5px 0;
        font-size: 12px;
    }
    .limit-label { color: #64748b; }
    .limit-value { font-weight: 600; color: #cbd5e1; }
    .info {
        color: #64748b;
        font-size: 12px;
        line-height: 1.5;
        margin-bottom: 12px;
    }
    .info code {
        background: rgba(139, 92, 246, 0.15);
        color: #a78bfa;
        padding: 1px 5px;
        border-radius: 3px;
        font-size: 11px;
    }
    #limits-container { display: none; }
    #diagrams-container { display: none; }
    .section-title {
        font-size: 11px;
        font-weight: 700;
        margin-bottom: 8px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    .diagrams-list {
        max-height: 200px;
        overflow-y: auto;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .diagram-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        cursor: pointer;
        font-size: 12px;
        transition: background 0.15s;
    }
    .diagram-item:last-child { border-bottom: none; }
    .diagram-item:hover { background: rgba(139, 92, 246, 0.08); }
    .diagram-name {
        font-weight: 600;
        color: #e2e8f0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 150px;
    }
    .diagram-date { color: #475569; font-size: 11px; white-space: nowrap; }
    .divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.06);
        margin: 16px 0;
    }
</style>
</head>
<body>
    <div class="header">
        <img src="${logoUri}" alt="Ark95" />
        <div class="header-title">ARK95</div>
        <div class="header-subtitle">Architecture Diagrams</div>
    </div>
    <div class="content">
    ${isLoggedIn ? this.getLoggedInHtml(user!) : this.getLoginHtml()}

    <script>
        const vscode = acquireVsCodeApi();

        function send(command) { vscode.postMessage({ command }); }

        window.addEventListener('message', (e) => {
            const msg = e.data;
            if (msg.command === 'limitsUpdate' && msg.limits) {
                const c = document.getElementById('limits-container');
                if (c) {
                    c.style.display = 'block';
                    const l = msg.limits;

                    // Diagrams row
                    if (l.diagramLimit === -1) {
                        document.getElementById('l-diagrams').textContent = l.diagramCount + ' (unlimited)';
                    } else {
                        document.getElementById('l-diagrams').textContent = l.diagramCount + ' / ' + l.diagramLimit;
                    }

                    document.getElementById('l-total').textContent = l.totalUsed + ' / ' + l.totalLimit;

                    // Show monthly/daily only for pro
                    if (!l.isFree) {
                        document.getElementById('r-monthly').style.display = 'flex';
                        document.getElementById('r-daily').style.display = 'flex';
                        document.getElementById('l-monthly').textContent = l.monthlyUsed + ' / ' + l.monthlyLimit;
                        document.getElementById('l-daily').textContent = l.dailyUsed + ' / ' + l.dailyLimit;
                    }

                    // Remaining: min of sync remaining and diagram remaining
                    const syncRemaining = Math.max(0, l.totalLimit - l.totalUsed);
                    const diagramRemaining = l.diagramLimit === -1 ? Infinity : Math.max(0, l.diagramLimit - l.diagramCount);
                    const remaining = Math.min(syncRemaining, diagramRemaining);
                    document.getElementById('l-remaining').textContent = remaining === Infinity ? 'unlimited' : remaining;

                    if (l.cooldownActive && l.nextAllowedAt) {
                        const mins = Math.max(0, Math.ceil((new Date(l.nextAllowedAt).getTime() - Date.now()) / 60000));
                        document.getElementById('l-cooldown').textContent = mins + ' min';
                    } else {
                        document.getElementById('l-cooldown').textContent = 'Ready';
                    }
                }

                // Disable generate button if free user hit diagram limit
                const btn = document.getElementById('btn-generate');
                const info = document.getElementById('generate-info');
                if (btn && l.diagramLimit !== -1 && l.diagramCount >= l.diagramLimit) {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                    if (info) info.textContent = 'Diagram limit reached (' + l.diagramCount + '/' + l.diagramLimit + ').' + (l.isFree ? ' Upgrade to Pro.' : '');
                } else if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                    if (info) info.innerHTML = 'Reads your workspace and generates the <code>.ark95</code> file.';
                }
            }
            if (msg.command === 'diagramsUpdate' && msg.diagrams) {
                const c = document.getElementById('diagrams-container');
                const list = document.getElementById('diagrams-list');
                if (c && list) {
                    c.style.display = 'block';
                    list.innerHTML = '';
                    msg.diagrams.slice(0, 10).forEach(d => {
                        const date = new Date(d.createdAt);
                        const fmt = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
                        const name = d.name.length > 30 ? d.name.slice(0, 30) + '...' : d.name;
                        const item = document.createElement('div');
                        item.className = 'diagram-item';
                        item.innerHTML = '<span class="diagram-name">' + name + '</span><span class="diagram-date">' + fmt + '</span>';
                        item.addEventListener('click', () => {
                            vscode.postMessage({ command: 'openDiagram', diagramId: d.id });
                        });
                        list.appendChild(item);
                    });
                }
            }
        });

        // Request limits on load if logged in
        ${isLoggedIn ? "send('refreshLimits');" : ''}
    </script>
</div>
</body>
</html>`;
    }

    private getLogoHtml(): string {
        return '';
    }

    private getLoginHtml(): string {
        return /*html*/ `
        <div class="section">
            <p class="info" style="text-align:center;">
                Generate architecture diagrams from your codebase using AI.<br/>
                The <code>.ark95</code> file is versioned with your repo.
            </p>
            <button class="btn btn-primary" onclick="send('login')">Login with Ark95</button>
            <p class="info" style="margin-top: 8px; text-align: center; color: #475569;">
                You'll be redirected to your browser.
            </p>
        </div>`;
    }

    private getLoggedInHtml(user: { name: string; email: string; plan: string }): string {
        const planClass = user.plan === 'pro' ? 'plan-pro' : 'plan-free';
        const planLabel = user.plan === 'pro' ? 'PRO' : 'FREE';

        return /*html*/ `
        <div class="section">
            <div class="user-card">
                <div class="user-name">${escapeHtml(user.name)}</div>
                <div class="user-email">${escapeHtml(user.email)}</div>
                <span class="plan-badge ${planClass}">${planLabel}</span>
            </div>
        </div>

        <div class="section">
            <button class="btn btn-primary" id="btn-generate" onclick="send('generate')">
                Generate Architecture Diagram
            </button>
            <p class="info" id="generate-info">Reads your workspace and generates the <code>.ark95</code> file.</p>
        </div>

        <div class="section" id="limits-container">
            <div class="section-title">Usage</div>
            <div class="card">
                <div class="limit-row">
                    <span class="limit-label">Diagrams</span>
                    <span class="limit-value" id="l-diagrams">-</span>
                </div>
                <div class="limit-row">
                    <span class="limit-label">Syncs</span>
                    <span class="limit-value" id="l-total">-</span>
                </div>
                <div class="limit-row" id="r-monthly" style="display:none">
                    <span class="limit-label">Monthly</span>
                    <span class="limit-value" id="l-monthly">-</span>
                </div>
                <div class="limit-row" id="r-daily" style="display:none">
                    <span class="limit-label">Daily</span>
                    <span class="limit-value" id="l-daily">-</span>
                </div>
                <div class="divider" style="margin:6px 0;"></div>
                <div class="limit-row">
                    <span class="limit-label">Remaining</span>
                    <span class="limit-value" style="color:#8b5cf6;" id="l-remaining">-</span>
                </div>
                <div class="limit-row">
                    <span class="limit-label">Cooldown</span>
                    <span class="limit-value" id="l-cooldown">-</span>
                </div>
            </div>
        </div>

        <div class="section" id="diagrams-container">
            <div class="section-title">Your Diagrams</div>
            <div class="diagrams-list" id="diagrams-list"></div>
        </div>

        <div class="section">
            <button class="btn btn-secondary" onclick="send('openWeb')">Open Dashboard</button>
        </div>
        <div style="text-align:center;">
            <button class="btn btn-logout" onclick="send('logout')">Logout</button>
        </div>`;
    }
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
