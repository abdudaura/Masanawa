# ADR-0001: Core Languages and Frameworks

Status: accepted for foundation
Date: 2026-10-01

## Decision

- Core platform/domain/services: TypeScript 6.x.
- Runtime: Node.js 24 LTS.
- API services: Fastify.
- Web + Ops: Next.js 16 Active LTS with React.
- ML/media/GPU workers: Python 3.14, managed with uv.
- Durable database: PostgreSQL 18.
- JavaScript monorepo: pnpm workspaces.
- Browser E2E: Playwright.
- TypeScript tests: Vitest.
- Python tests: pytest.
- Realtime browser media transport: WebRTC.

## Rationale

The core business platform benefits from a single strongly typed language across contracts, domain logic, services and web applications. Python remains first-class only where its ML/media ecosystem has a real advantage. Go is not adopted merely because CyberVerse uses it; a third core language needs measured justification.

As of this decision, Node 24 is the primary LTS line, TypeScript 6 is stable, Next.js 16 is Active LTS, Python 3.14 is the active stable feature series and PostgreSQL 18 is current supported production PostgreSQL.

## Consequences

Donor Python/Go implementations are translated into canonical Masanawa designs rather than preserved by language.

Any major deviation requires a new ADR.
