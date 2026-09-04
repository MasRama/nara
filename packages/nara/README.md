# Nara CLI

Architecture-aware TypeScript application kit. Build by feature, not by layer.

This package ships the `nara` development-time architecture companion. It is
not a production runtime: generated applications carry it as an exact-pinned
devDependency so `nara doctor`, `inspect`, `context`, `impact`, `new`, and
`add` run reproducibly from the project's own install. The package has not
necessarily been published yet; before the first publish, `npm pack` from
`packages/nara` (via `npm run stage:package` from the repository root)
produces the same artifact the registry would serve.

```bash
npx nara new my-app
cd my-app
npm install
npm run dev
```

```bash
npm run check                  # typechecks, tests, and nara doctor
npx nara doctor                # validate architecture from the local install
npx nara context health --json
npx nara impact health --json
npx nara add audit             # install an official open-code feature
```

The underlying stack stays transparent: Hono handles HTTP, TypeScript defines
the application, and the CLI explains the repository without an LLM.

License: [MIT](./LICENSE). Repository: https://github.com/MasRama/nara
