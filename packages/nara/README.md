# `@nara-web/cli`

This is Nara's publishable npm package, named `@nara-web/cli`. It exposes the
`nara` executable, so generated projects use commands such as `nara doctor`,
`nara diff`, and `nara guard`.

Architecture-aware TypeScript application kit. Build by feature, not by layer.

This package ships the `nara` development-time architecture companion. It is
not a production runtime: generated applications carry it as an exact-pinned
devDependency so `nara doctor`, `guard`, `inspect`, `context`, `impact`,
`diff`, `new`, `add`, and `evolve` run reproducibly from the project's own install.
The package has not yet had its first npm registry publication. Before that
publish, `npm pack` from `packages/nara` (via `npm run stage:package` from the
repository root) produces the artifact intended for the registry. The `npx`
example below becomes the public registry entry point after that first publish.

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
