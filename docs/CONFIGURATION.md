# Configuration

## Local operation

Requires Node.js 22.13+; the server binds to `127.0.0.1`. The local tutoring engine works without external services. `npm run dev` optionally loads an ignored `.env` file.

| Variable | Purpose |
| --- | --- |
| `PORT` | Local port; default 4173 |
| `OPENAI_API_KEY` | Optional server-only AI credential; leave blank for offline tutoring |
| `OPENAI_MODEL` | Optional interpretation model identifier |
| `LUMA_AI_MAX_CALLS` | Optional local AI usage cap |

AI interpretation is a bounded aid for adult evaluation. It cannot turn an incorrect selected answer into a correct answer. Local session outcomes are not validated educational assessment.

## Private state

Progress saving is opt-in. Local SQLite state belongs under `data/`; generated evaluations belong under `artifacts/`. These folders are ignored. Never use real learner input in a public issue or fixture.

## Adult review material

`npm run review:educator` generates the HTML review and activity catalog from fictional authored source. It includes solutions and is intended for adults. `npm test` regenerates it through `pretest` so the HTTP/CSP regressions work from a fresh clone. Generated `docs/revision/` content is not necessary to publish or edit by hand.

Live AI evaluation scripts are explicit opt-ins, outside CI. Their existence does not imply that a provider has been configured or that their evaluations have been run.
