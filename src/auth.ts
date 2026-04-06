import * as vscode from 'vscode';
import { API_URL, FRONTEND_URL } from './config';

const TOKEN_KEY = 'ark95.token';

export interface Ark95User {
    id: string;
    name: string;
    email: string;
    plan: string;
    role: string;
    language: string;
    stripeSubscriptionStatus?: string;
    stripeCurrentPeriodEnd?: string;
}

export class AuthService {
    private token: string | undefined;
    private user: Ark95User | undefined;
    private _onDidChangeAuth = new vscode.EventEmitter<Ark95User | undefined>();
    readonly onDidChangeAuth = this._onDidChangeAuth.event;

    constructor(private context: vscode.ExtensionContext) {}

    async init() {
        this.token = await this.context.secrets.get(TOKEN_KEY);
        if (this.token) {
            await this.fetchUser();
        }
    }

    getToken(): string | undefined {
        return this.token;
    }

    getUser(): Ark95User | undefined {
        return this.user;
    }

    isLoggedIn(): boolean {
        return !!this.token && !!this.user;
    }

    async loginViaBrowser() {
        const state = randomState();
        const loginUrl = `${FRONTEND_URL}/vscode-auth?state=${state}`;
        await vscode.env.openExternal(vscode.Uri.parse(loginUrl));
        vscode.window.showInformationMessage('Ark95: Complete login in your browser.');
    }

    async handleAuthCallback(token: string) {
        this.token = token;
        await this.context.secrets.store(TOKEN_KEY, token);
        await this.fetchUser();
        if (this.user) {
            vscode.window.showInformationMessage(`Ark95: Logged in as ${this.user.name}`);
        }
    }

    async fetchUser(): Promise<Ark95User | undefined> {
        if (!this.token) return undefined;
        try {
            const res = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Cookie': `token=${this.token}` },
            });
            if (!res.ok) {
                await this.logout();
                return undefined;
            }
            this.user = await res.json() as Ark95User;
            this._onDidChangeAuth.fire(this.user);
            return this.user;
        } catch {
            return undefined;
        }
    }

    async logout() {
        this.token = undefined;
        this.user = undefined;
        await this.context.secrets.delete(TOKEN_KEY);
        this._onDidChangeAuth.fire(undefined);
        vscode.window.showInformationMessage('Ark95: Logged out.');
    }

    dispose() {
        this._onDidChangeAuth.dispose();
    }
}

function randomState(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
