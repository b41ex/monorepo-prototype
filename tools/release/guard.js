#!/usr/bin/env node
/**
 * Refuse a real `nx release` anywhere but `main`.
 *
 * WHY THIS EXISTS
 *
 * Release finish is `nx release --skip-publish`, run from `main` after a fast-forward. Run the
 * same command one branch earlier, on `release`, and it does the whole thing to the wrong ref:
 * it versions, commits, tags, and PUSHES `release`, then creates GitHub Releases pointing at a
 * commit that is not on `main`. Two CI runs follow, and the `src-` tag race becomes reachable.
 *
 * Nothing about the command says which branch it is on. `--dry-run` does not help either: its
 * output is identical on `release` and on `main`, because it prints the branch you are standing
 * on rather than the branch you should be. The failure is one forgotten `git switch`.
 *
 * WHY NOT A GIT HOOK
 *
 * A pre-push hook was the obvious answer and it does not work. Nx pushes with
 * `git push --follow-tags --no-verify --atomic` — `--no-verify` means pre-push never fires.
 * Checked in nx 23.2.0, utils/git.js. A hook would have been a safeguard that silently does
 * nothing, which is worse than none.
 *
 * WHY preVersionCommand
 *
 * It is Nx's own hook, so it cannot be sidestepped by invoking `nx release` directly, and it
 * runs FIRST — before versioning, before the commit, before the tag, before the push. A
 * non-zero exit here reaches `process.exit(1)` in Nx's runPreVersionCommand and nothing has
 * happened yet. Compare the token failure, which lands after the push has already succeeded
 * and cannot be retried because the tag is consumed.
 *
 * DRY RUNS ARE ALLOWED ON PURPOSE
 *
 * Nx sets NX_DRY_RUN=true for this command when `--dry-run` is passed. Reading the plan from
 * `release` before deciding to promote is legitimate and writes nothing, so it is permitted.
 * The plan is identical either way: versions resolve from `component/version` tags, which are
 * not branch-scoped, and `main` is a fast-forward of `release`, so HEAD reaches the same
 * commits.
 *
 * Wired in nx.json as release.version.preVersionCommand.
 */
const { execFileSync } = require('node:child_process')

const RELEASE_BRANCH = 'main'

// execFileSync, not execSync: this runs through cmd.exe on Windows, where `^` is the escape
// character. A `git show <sha>^:<path>` in a sibling tool silently read the wrong revision for
// exactly that reason, and both sides then compared equal.
function git(...args) {
  return execFileSync('git', args, { encoding: 'utf-8' }).trim()
}

// Nx pipes this command's stdio unless --verbose, so a plain console.log can be swallowed.
// The message has to travel in the thrown Error, which Nx prints in its failure body.
function refuse(lines) {
  for (const line of lines) process.stderr.write(line + '\n')
  process.exit(1)
}

if (process.env.NX_DRY_RUN === 'true') {
  console.log(`release guard: dry run, branch not checked (real releases must be on ${RELEASE_BRANCH})`)
  process.exit(0)
}

let branch
try {
  branch = git('rev-parse', '--abbrev-ref', 'HEAD')
} catch (e) {
  refuse(['release guard: could not read the current branch', String(e)])
}

if (branch === 'HEAD') {
  refuse([
    'release guard: HEAD is detached.',
    `A release must be made from ${RELEASE_BRANCH} so the tags Nx creates land on a branch.`,
    `Run: git switch ${RELEASE_BRANCH} && git merge --ff-only release`,
  ])
}

if (branch !== RELEASE_BRANCH) {
  refuse([
    `release guard: refusing to release from "${branch}".`,
    '',
    `A real release must run on ${RELEASE_BRANCH}. From "${branch}" Nx would version, commit, tag`,
    `and PUSH "${branch}", then create GitHub Releases against a commit that is not on`,
    `${RELEASE_BRANCH} — and pushing two refs at one commit starts two CI runs that both build.`,
    '',
    'Promote first, then release:',
    `  git switch ${RELEASE_BRANCH}`,
    '  git merge --ff-only release',
    '  pnpm exec nx release --skip-publish',
    '',
    'To read the plan from here without releasing, add --dry-run.',
  ])
}

console.log(`release guard: on ${branch}, proceeding`)
