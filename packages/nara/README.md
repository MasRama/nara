# `@nara-web/cli`

Nara is distributed on npm as `@nara-web/cli`. The package exposes the `nara` executable, so generated projects continue using commands such as `nara doctor`, `nara diff`, and `nara guard`.

Architecture-aware TypeScript application kit. Build by feature, not by layer.

This package ships the `nara` development-time architecture companion. It is
not a production runtime: generated applications carry it as an exact-pinned
devDependency so `nara doctor`, `guard`, `inspect`, `context`, `impact`,
`diff`, `new`, and `add` run reproducibly from the project's own install. The package
has not necessarily been published yet; before the first publish, `npm pack`
from `packages/nara` (via `npm run stage:package` from the repository root)
produces the same artifact the registry would serve.

```bash
npx @nara-web/cli new my-app
cd my-app
npm install
npm run dev
```

```bash
npm run check                  # typechecks, tests, and nara doctor
npx nara doctor                # validate current architecture from the local install
npx nara guard --base origin/main  # fail only on newly introduced violations
npx nara context health --json
npx nara impact health --json
npx nara diff --base main      # how the architecture is changing
npx nara add audit             # install an official open-code feature
```

The underlying stack stays transparent: Hono handles HTTP, TypeScript defines
the application, and the CLI explains the repository without an LLM.

License: [MIT](./LICENSE). Repository: https://github.com/MasRama/nara
