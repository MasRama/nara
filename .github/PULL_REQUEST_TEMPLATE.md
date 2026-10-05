## What changed?

<!-- Describe the problem and the smallest coherent solution in this PR. -->

## Why?

<!-- Link the issue when one exists, for example: Closes #123. -->

## Architecture impact

<!--
Call out changes to Feature ownership, application composition, generated-project
contracts, CLI semantics, lineage/evolution, dependencies, or JSON output.
Write "None" when there is no architecture-visible change.
-->

## Validation

<!-- List the commands or focused checks you ran. -->

- [ ] `npm run check:fast`
- [ ] `npm run check` when heavy lifecycle/release-sensitive behavior is affected
- [ ] `npm run test:integration` when integration-tier behavior is affected
- [ ] Relevant focused/integration tests when applicable

## Review checklist

- [ ] The change is focused and does not include unrelated cleanup.
- [ ] Tests were added or updated for behavior changes.
- [ ] Public behavior changes are documented.
- [ ] No secrets, generated local data, or private information are included.
- [ ] Breaking changes, if any, are called out explicitly.
