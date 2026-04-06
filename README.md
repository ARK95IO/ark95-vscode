<p align="center">
  <img src="media/icon.png" alt="Ark95 Logo" width="128" />
</p>

<h1 align="center">Ark95 - Architecture Diagrams</h1>

<p align="center">
  <strong>Generate architecture diagrams from your current repository in one click. No API keys required.</strong>
</p>

<p align="center">
  <a href="https://ark95.io/en/register">Create your free account</a> &middot;
  <a href="https://ark95.io">Website</a>
</p>

---

## What is Ark95?

Ark95 turns your codebase into a visual architecture diagram — automatically. Open any project in VS Code, click **Generate**, and get a full dependency map with services, databases, queues, caches, and more.

**No tokens consumed from your side.** Ark95 does not use your Copilot, Claude, Gemini, or any other AI credits. The AI analysis runs entirely on Ark95's infrastructure at no cost to you.

## How it works

1. **Sign in** — Create a free account at [ark95.io/en/register](https://ark95.io/en/register) and authorize the extension.
2. **Open your project** — Open any repository in VS Code.
3. **Generate** — Click the Ark95 icon in the sidebar and hit **Generate Architecture Diagram**.
4. **View** — Your diagram opens on [ark95.io](https://ark95.io) with an interactive, editable canvas.

The extension reads your source files locally, sends them securely to the Ark95 API for AI analysis, and returns a structured architecture diagram. **Your code is never stored** — it is only used in-memory during analysis and immediately discarded.

## Features

- **One-click diagram generation** from any repository
- **AI-powered analysis** that detects services, databases, queues, workers, caches, external APIs, and their connections
- **Detailed edge metadata** — HTTP methods, endpoints, database operations, queue topics, protocols
- **Smart layout** — automatic node positioning using a graph-based algorithm
- **Interactive diagrams** — view and edit on the Ark95 web platform
- **`.ark95` file support** — syntax highlighting and quick open for diagram files
- **Privacy-first** — your source code is never persisted; only the generated diagram is saved

## Supported languages & files

TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Ruby, PHP, C#, Swift, Scala, Vue, Svelte, YAML, TOML, JSON, Prisma, GraphQL, Protocol Buffers, SQL, Terraform, HCL, Shell scripts, Dockerfiles, and more.

## Plans

| | Free | Pro |
|---|---|---|
| Diagrams | 3 | Unlimited |
| Syncs | 3 total | 30/month |
| Cooldown | 1 hour | 1 hour |
| Price | $0 | $9/month |

[Upgrade to Pro](https://ark95.io)

## Privacy & Security

- Source code is transmitted over HTTPS and analyzed in-memory only
- No code is stored on Ark95 servers or databases
- `.env` files, credentials, and secrets are automatically filtered out
- Only the generated diagram (nodes and edges) is persisted
- Authentication uses secure JWT tokens stored in your OS keychain

## Requirements

- VS Code 1.85 or later
- A free Ark95 account — [sign up here](https://ark95.io/en/register)

## Commands

| Command | Description |
|---|---|
| `Ark95: Login` | Sign in to your Ark95 account |
| `Ark95: Logout` | Sign out |
| `Ark95: Generate Architecture Diagram` | Analyze current workspace and generate a diagram |
| `Ark95: Open .ark95 Diagram on Web` | Open a `.ark95` file on the Ark95 platform |

## Feedback & Support

Found a bug or have a suggestion? Reach out at [ark95.io](https://ark95.io) or open an issue on our repository.

---

<p align="center">
  Made with care by the <a href="https://ark95.io">Ark95</a> team.
</p>
