# Pizza Prime Manager

Pizza Prime Manager is a multi-role management platform for pizza operations, built to centralize administrative control, store operations, delivery workflows, customer engagement, campaigns, financial tracking, and performance reporting.

The application is designed for teams that need a modern operational dashboard with role-specific experiences for managers, pizzerias, couriers, and customers.

## Project Overview

This repository contains a Vite, React, and TypeScript web application integrated with Supabase services. It uses a component-based interface, protected business flows, data dashboards, financial screens, campaign management, and reporting utilities.

The project supports the following main areas:

- Manager dashboard for business-wide supervision.
- Pizzeria workspace for local store operations.
- Courier interface for delivery execution.
- Customer area for registration, coupons, rankings, orders, rewards, and profile management.
- Financial modules for revenue, costs, transfers, charges, daily reports, and projections.
- Performance analysis for sales and customer metrics.
- Campaign, raffle, WhatsApp, and consumer management features.
- Supabase migrations and Edge Functions for backend workflows.

## Core Features

- Multi-role routing for managers, pizzerias, couriers, and customers.
- Financial visibility across revenue, costs, transfers, charges, daily summaries, and projections.
- Pizzeria registration, profile management, and operational dashboards.
- Customer lifecycle tools including registration, coupons, rankings, rewards, and order history.
- Delivery-focused screens for courier orders, maps, and profile data.
- Campaign and raffle management for customer engagement.
- Reporting utilities for pizzeria, consumer, and cycle-based analysis.
- Supabase database migrations and serverless functions.
- Automated test setup with Vitest and Testing Library.
- Modern UI foundation using Tailwind CSS, Radix UI, shadcn-style components, and React Query.

## Technology Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI
- React Router
- TanStack React Query
- Supabase
- Vitest
- Playwright
- ESLint
- Cloudflare Workers configuration via Wrangler

## Repository Structure

```text
.
|-- App.tsx                  # Application routes and role-specific entry points
|-- components/              # Shared and domain UI components
|-- contexts/                # React context providers
|-- data/                    # Mock and dashboard data
|-- hooks/                   # Shared React hooks
|-- lib/                     # Utilities and report generation helpers
|-- pages/                   # Application pages by user domain
|-- public/                  # Static assets
|-- src/                     # Source support files and duplicated app utilities
|-- supabase/                # Supabase config, migrations, and Edge Functions
|-- test/                    # Test setup and examples
|-- opencode.json            # OpenCode MCP configuration
|-- vite.config.ts           # Vite configuration
|-- vitest.config.ts         # Vitest configuration
|-- wrangler.jsonc           # Cloudflare Workers configuration
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- Bun or npm-compatible package manager
- Supabase project credentials when using live backend features

### Installation

```bash
bun install
```

If Bun is not available, use your preferred Node package manager consistently with the lockfile strategy adopted by the team.

### Development

```bash
bun run dev
```

### Build

```bash
bun run build
```

### Tests

```bash
bun run test
```

### Lint

```bash
bun run lint
```

## Environment Variables

The project may require environment variables for Supabase and deployment integrations. Do not commit `.env` files or secrets to the repository.

Use a local environment file for development and configure production secrets directly in the hosting platform, Supabase dashboard, or CI/CD provider.

## Supabase

Supabase assets are stored under `supabase/`:

- `supabase/migrations/` contains database schema changes.
- `supabase/functions/` contains Edge Functions for backend workflows.
- `supabase/config.toml` contains local Supabase function configuration.

Deploy Supabase Edge Functions separately from the frontend when backend logic changes.

## OpenCode MCP

This repository includes an `opencode.json` file for connecting OpenCode to Supabase through the official remote MCP server.

Configured project:

- Supabase REST URL: `https://axbrjlxwslkpttvgsahi.supabase.co/rest/v1/`
- Supabase project ref: `axbrjlxwslkpttvgsahi`
- MCP server: `https://mcp.supabase.com/mcp`
- Mode: read-only via `read_only=true`
- Enabled feature groups: `database`, `docs`, and `development`

OpenCode authenticates the hosted Supabase MCP server through OAuth. Do not store service role keys, personal access tokens, or production secrets in `opencode.json`.

To authenticate locally, run:

```bash
npx -y opencode-ai mcp auth supabase
```

To check the MCP status, run:

```bash
npx -y opencode-ai mcp list
```

The current MCP configuration is intentionally read-only. Any write, migration, or cleanup operation must be explicitly reviewed and authorized before execution.

## Security Guidelines

- Never commit credentials, API keys, service role keys, private tokens, or production `.env` files.
- Keep Supabase Row Level Security policies reviewed before production deployment.
- Validate user input both in the frontend and backend functions.
- Restrict privileged operations to trusted server-side contexts.
- Review dependency updates before deployment.

## Quality Standards

This project aims to follow international software delivery standards:

- Clear module boundaries by business domain.
- Type-safe implementation with TypeScript.
- Repeatable local development and build scripts.
- Automated tests for regression protection.
- Secure handling of credentials and backend permissions.
- Documented deployment and operational responsibilities.
- Consistent UI patterns through shared components.

## Branching Policy

Development and validation changes should be made in dedicated branches before being merged into `main`.

For this repository, the `teste` branch is used for validation work. Do not push directly to `main` without explicit authorization from the repository owner.

## License

Copyright (c) 2026 Gabriel Honorato.

All rights reserved unless a separate license file or written agreement states otherwise.

This repository is currently distributed as proprietary software. You may not copy, modify, sublicense, distribute, commercialize, or deploy this project outside the authorization granted by the owner.

If the project is later released under an open-source license, add a dedicated `LICENSE` file at the repository root and update this section to reference the selected license, such as MIT, Apache License 2.0, GPLv3, or another license approved by the owner.

## Third-Party Licenses

This project uses open-source dependencies. Each dependency remains governed by its own license terms. Review the dependency tree and package metadata before commercial distribution or enterprise deployment.

Key dependency families include:

- React and React ecosystem packages.
- Supabase JavaScript client.
- Radix UI primitives.
- Tailwind CSS utilities.
- Vite, TypeScript, ESLint, Vitest, and Playwright tooling.

## Maintainer

Gabriel Honorato

GitHub: [gaabrielhonorato/pizza-prime-manager](https://github.com/gaabrielhonorato/pizza-prime-manager)
