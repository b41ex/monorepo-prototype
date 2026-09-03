# APIHUB monorepo — third prototype

The 18 JavaScript components of APIHUB assembled into one pnpm workspace, from
`_existing_phase1b/` at the commits in [`tools/migration/source-commits.txt`](tools/migration/source-commits.txt).

**This is a prototype, not the migration.** Its deliverable is the gap list in
`../migration/UPSTREAM-GAPS.md`; the narrative is `../migration/PROTOTYPE3-LOG.md`. Local
only, no remote, nothing published.

## State

| | |
|---|---|
| Package manager | pnpm 10.34.5, `node-linker=isolated` set explicitly in `.npmrc` |
| Node | 24.15.0 |
| Scope | `@b41ex`, not `@netcracker` — see the warning below |
| Projects | 34 workspace projects; **18 build targets**, 13 test targets |
| Build | **18 of 18 green**, `pnpm -r build` exit 0 |
| Test | **12 of 12 runnable targets green, 10,621 passing** — exactly the fleet baseline |
| Go | **none.** No `backend/`, no `go.work`, deliberately |
| Nx | not wired. `pnpm -r` orders topologically and was enough |

## The scope rename does not cover everything

`frontend/vscode` is named `qubership-apihub-vscode` — **unscoped**, so the `@netcracker` →
`@b41ex` rename has no scope to rewrite — and it is **not `private`**, so a bare
`pnpm publish -r` would select it and the root `.npmrc` routes unscoped names to the public
registry, where that name is unclaimed. **Do not run `pnpm publish -r` here.** UPSTREAM-GAPS
G25; the one-line fix is `"private": true` upstream.

## How to run things

`CI=true` must be unset or `--no-frozen-lockfile` passed — `CI=true` makes pnpm default to
`--frozen-lockfile`, which fails after any `package.json` edit.

```bash
pnpm install --no-frozen-lockfile
pnpm -r --no-bail build
pnpm -r --no-bail --filter='!qubership-apihub-vscode' test
```

`vscode` is excluded from the test sweep because its `test` launches a real VS Code instance.

**Do not pass runner flags through `pnpm -r`.** `pnpm -r test -- --no-cache` makes jest read
`--no-cache` as a *test name pattern*, and every project reports `No tests found, exiting with
code 1` — which reads as a fleet-wide red. To run without the ts-jest cache, delete jest's
cache directory first.

On Windows, `pnpm` in a background shell exits 127: its shim ends with a bare `exec node`, and
background shells intermittently lose node from PATH. Call
`node "$APPDATA/npm/node_modules/pnpm/bin/pnpm.cjs"` directly.

## What this repository carries that is not upstream

Two things, both recorded as gaps rather than treated as fixes:

| | |
|---|---|
| `pnpm-workspace.yaml` `overrides` — 5 entries | The per-component `overrides` blocks in `api-doc-viewer`, `apispec-view`, `class-view` and `rest-playground` go **inert** the moment those repositories stop being install roots. G15 and G23. Both verified at the tree, not from an exit code |
| 4 declarations in `apispec-view/packages/elements` | `webpack`, `webpack-cli`, `postcss`, `postcss-cli` — at the versions the apispec-view root already declares. Without them three build targets fail. **G28**, and it must go upstream or it regresses |

## What was not measured here, and must not be inferred

- **The three screenshot suites** — `api-doc-viewer` 947, `apispec-view` 883, `class-view` 58
  — and the **full-stack E2E**. All container- or CI-only. For `apispec-view`, `class-view`
  and `build-task-consumer` that means **"it builds" is the only claim this run makes.**
- **L5b**, loading the built front end in a browser against a stub. Not run. It is the level
  that catches the defects a green build ships.
- **§8's release tooling**, because `npm-gitflow` is out of scope — which is where G25 lives.
- **Everything Go**: §3's `backend/` tree, §5's cross-language orchestration, G2.
