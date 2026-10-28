# Luma — architecture

A Spanish-language local learning app with 36 fraction, pattern and logic activities, adaptive tutoring and optional AI interpretation.

## Code boundaries

- **server.js:** Loopback HTTP server and session routes.
- **lib/:** Tutoring, reasoning, adaptation, persistence and evaluation cases.
- **public/:** Learning interface and browser interaction modules.
- **test/:** Offline behavioral and security regressions.
- **scripts/:** Reproducible evaluation and adult-review tools.
- **docs/:** Developer guidance and selected Spanish product specifications.

## Data boundary

This public repository contains application source and fictional test inputs. Personal/operational state belongs in ignored local storage or separately configured services. Test results establish the behavior exercised by the suite; they do not certify live integrations, product efficacy or deployment readiness.

See the README for implementation status and `CONFIGURATION.md` for provider-specific requirements.
