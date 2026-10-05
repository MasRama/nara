# Contributing to Nara

Thanks for helping improve Nara.

Nara is an architecture-aware TypeScript application kit built around composable,
evolvable open code. Contributions should preserve that model: features own their
implementation, application composition stays explicit, and architecture rules
remain enforceable by tooling rather than convention alone.

## Before you start

For substantial changes, open an issue first. This is especially useful for:

- new CLI behavior or public commands;
- new official Features;
- changes to generated-project structure;
- architecture rules or dependency boundaries;
- breaking changes;
- behavior that changes how existing projects evolve.

Small documentation corrections and narrowly scoped fixes can go directly to a
pull request.

Security vulnerabilities must not be reported in public issues. Follow
[`SECURITY.md`](./SECURITY.md) instead.

## Local setup

Nara requires:

- Node.js 22 or newer;
- npm 10.9.8.

Install dependencies from the repository root:

```bash
npm ci
```

For application development, copy the example environment when needed:

```bash
cp .env.example .env
```

Run the development server with:

```bash
npm run dev
```

## Architecture expectations

Before changing implementation structure, read:

- [`ARCHITECTURE.md`](./ARCHITECTURE.md);
- [`docs/v3/feature-model.md`](./docs/v3/feature-model.md);
- [`docs/v3/architecture-philosophy.md`](./docs/v3/architecture-philosophy.md).

The important defaults are:

- build by Feature, not by technical layer;
- keep application-wide composition under `src/app/`;
- do not import another Feature's internals;
- keep server-only code out of browser code;
- make server authorization authoritative;
- keep official Features inspectable and application-owned after installation;
- prefer explicit TypeScript and ordinary platform primitives over hidden runtime
  frameworks, DI containers, or generated RPC layers.

If a change intentionally alters one of these rules, explain why in the issue and
pull request instead of working around the architecture checks.

## Branches and commits

Create a focused branch from the latest `main`. Examples:

```text
feat/official-auth
fix/database-backup-timeout
docs/contribution-workflow
chore/release-prep
```

Keep commits understandable and scoped. Nara commonly uses Conventional
Commit-style prefixes such as `feat:`, `fix:`, `docs:`, `refactor:`,
`test:`, and `chore:`.

Do not mix unrelated cleanup into a feature or bug-fix pull request.

## Validation

Run the main repository gate before opening or updating a pull request:

```bash
npm run check
```

This covers TypeScript, Vue typechecking, the Vitest suite, and architecture
validation.

Also run a production build when the change can affect runtime code, frontend
assets, package composition, or build configuration:

```bash
npm run build
```

Changes to packaging, generated projects, official Features, production serving,
or release mechanics may require the more focused integration commands listed in
`package.json`. Release work should pass:

```bash
npm run validate:release
```

Machine-sensitive performance sanity checks are intentionally separate:

```bash
npm run perf:sanity
```

## Tests

Add or update tests when behavior changes.

Prefer tests at the boundary that owns the behavior:

- Feature behavior belongs with that Feature;
- architecture rules belong in architecture/CLI tests;
- generated-project and packaging behavior belongs in integration tests;
- browser-facing Vue behavior should use the existing Vue/Vitest test setup.

Avoid weakening an existing assertion only to make a change pass. If an expected
contract is changing, update the contract and explain the reason.

## Pull requests

A pull request should:

- solve one coherent problem;
- link its issue when one exists (for example, `Closes #123`);
- explain user-visible and architecture-visible effects;
- include the validation that was run;
- update documentation for public behavior changes;
- avoid drive-by dependency or formatting churn.

Maintainers may merge their own pull requests. CI is still expected to be green
before merge; self-maintained does not mean bypassing the repository gates.

## Reviews and compatibility

Review focuses on correctness, architecture boundaries, maintainability, and the
experience of generated Nara applications.

Backward compatibility matters most for:

- CLI command semantics;
- generated-project contracts;
- official Feature composition;
- lineage/evolution behavior;
- machine-readable JSON output.

If a breaking change is necessary, call it out clearly so it can be versioned
and documented deliberately.

## License

By contributing, you agree that your contribution is licensed under the
repository's [MIT License](./LICENSE).
