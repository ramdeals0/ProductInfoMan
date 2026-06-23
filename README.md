# ProductInfoMan

Product Information Management (PIM) system for ecommerce catalog governance.

## Planning (Phase 0)

Foundation planning artifacts are in [`docs/planning/`](./docs/planning/README.md):

- Requirements, domain model, epics, MVP scope
- Discovery workshop questionnaire
- Repository structure and architecture outline

**Status:** Planning complete. Implementation not started.

## Development Setup (Scaffold)

The repository includes an early Prisma 7 + TypeScript scaffold. This will evolve per the target structure in `docs/planning/06-repo-structure.md`.

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
```

## License

ISC
