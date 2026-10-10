# Current Masanawa documentation

**Only active product/development guidance:**

1. [Master product](rebuild/BLUEPRINT.md)
2. [All screens and journeys](rebuild/SCREENS.md)
3. [Architecture, DB, APIs and workers](rebuild/ARCHITECTURE.md)
4. [Implementation recovery, milestones, tests and releases](rebuild/DELIVERY.md)
5. [One reusable development-window prompt](rebuild/WINDOW-PROMPT.md)
6. [12 seeded character definitions](rebuild/SEED-MASANA.json) · [sample posts, Room welcomes and questions](rebuild/SEED-CONTENT.json)

Root [AGENTS.md](../AGENTS.md) and [CONTINUE-HERE.md](../CONTINUE-HERE.md) take precedence for workflow. No legacy product/archived guidance is active or retained as a second path.

Existing *technical* files (architecture, currently integrated API/security/financial/storage/CI contracts, source provenance, active PR handoffs) are only supporting **implementation evidence**, never authority to restore eliminated features. If a technical contract contradicts the new product, amend it with the owned feature change before shipping; do not treat the old UX as default. Applied PostgreSQL migrations, receipts and audited financial data must not be deleted.
