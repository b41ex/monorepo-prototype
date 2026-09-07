#!/usr/bin/env bash
#
# One cache block per job, the same shape in every job.
#
# WHAT THIS REPORTS, AND WHAT IT REFUSES TO
#
# Every figure here comes from the tool that USED the cache, never from the step that restored
# it. That is the whole design, and it is the rule this pipeline paid for five times:
#
#   `actions/cache` says "Cache restored from key …" whenever bytes arrived. It said exactly
#   that while Nx used none of them, for five distinct reasons in sequence — the wrong path,
#   artifacts without their metadata database, `plan` claiming `js`'s key, and matrix legs
#   claiming each other's. All five were green at the restore step.
#
# So the restore line is deliberately ABSENT from this summary. Promoting the most misleading
# signal in the pipeline to the most prominent place would make the table look more complete
# and read worse. What appears instead:
#
#   Nx           its own `Cache: N/N hit (P%)` line, the only number that means anything
#   pnpm store   `pnpm install`'s own "downloaded N" — 0 means the store served everything
#
# The buildx layer cache is not here. Its verdict is the `#N CACHED` step count inside
# docker/build-push-action's output, which this script does not see; adding it means capturing
# that action's log, which is more plumbing than the rest of this put together.
#
# Usage:  cache-summary.sh <label> [nx-log] >> "$GITHUB_STEP_SUMMARY"
#
# The label names the job or matrix leg, because these blocks stack on the run page and a
# block that does not say which leg it belongs to is worse than no block.
#
# Never fails the step it is called from. It runs with `if: always()`, which means it runs on
# the failures where the numbers matter most, and a reporting script that can redden a job is
# a bad trade — a lesson from a diagnostic that exited 1 on its own cosmetic tail.
set -uo pipefail

label="${1:-unknown}"
nx_log="${2:-}"

strip_ansi() { sed 's/\x1b\[[0-9;]*m//g'; }

nx_line="—"
if [ -n "$nx_log" ] && [ -s "$nx_log" ]; then
  # `Cache:   29/29 hit (100%)`, after colour codes are removed.
  hit="$(strip_ansi < "$nx_log" | grep -oE 'Cache: +[0-9]+/[0-9]+ hit \([0-9]+%\)' | tail -1 || true)"
  if [ -n "${hit:-}" ]; then
    counts="$(printf '%s' "$hit" | grep -oE '[0-9]+/[0-9]+ hit \([0-9]+%\)')"
    nx_line="**${counts%% hit*} tasks from cache** (${counts##*\(}"
    nx_line="${nx_line%)*})"
  else
    # Nx ran but scheduled nothing cacheable, or did not get far enough to print a summary.
    nx_line="_no cacheable tasks reported_"
  fi
else
  nx_line="_no Nx tasks in this job_"
fi

scope="${CACHE_NX_SCOPE:-unknown}"
store_state="${CACHE_PNPM_STORE:-unknown}"
downloaded="${CACHE_PNPM_DOWNLOADED:-?}"

pnpm_line="**downloaded ${downloaded}**"
if [ "$downloaded" = "0" ]; then
  pnpm_line="$pnpm_line — the store served every package"
fi

printf '### Cache — %s\n\n' "$label"
printf '| | |\n|---|---|\n'
printf '| Nx computation | %s, scope `%s` |\n' "$nx_line" "$scope"
printf '| pnpm store | %s, %s |\n' "$pnpm_line" "$store_state"
printf '\n<sub>Both figures are what the tool that used the cache reported. '
printf "The <code>actions/cache</code> restore line is omitted on purpose: it has been green through five separate Nx cache failures.</sub>\n\n"
