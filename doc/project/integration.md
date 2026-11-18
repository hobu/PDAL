(integration)=

# Continuous Integration

PDAL runs its {ref}`regression tests <pdal_test>` with [GitHub Actions]. Fork
pull requests start with a Linux ARM64 gate before a maintainer approves the
full platform matrix. Maintainers pushing branches directly to `PDAL/PDAL`
continue to get full CI automatically.

## When builds run

| Event | Build behavior |
| --- | --- |
| Fork PR opened, reopened, or updated | Run the initial ARM64 gate. Run the full matrix afterward only if an authorized `ci:full` label is present. |
| An authorized user applies `ci:full` | Start a new run, recheck ARM64, then run the full matrix if the gate passes. |
| Maintainer pushes a branch to `PDAL/PDAL` | Run ARM64 and the full platform matrix in parallel, without a PR or label. |
| PR from a branch already in `PDAL/PDAL` | Use the branch's push checks without starting duplicate gated builds. |
| Feature-branch push to a fork without a PR | No build runners are started. Skipped standalone workflow runs may appear in Actions. |

Changes exclusively under `doc/` skip build CI. A PR with both documentation and
code changes follows the normal flow; the PR filter considers the overall PR
changes, so a later documentation-only commit does not exempt an existing code
PR. Documentation builds are separate, as described below.

The existing `dependabot/**` branch-push exclusion remains. Dependabot PRs use
the gated flow even when their branches are in `PDAL/PDAL`. Fork `master` and tag
builds retain their standalone triggers. PRs between branches of a testing fork,
such as `hobu/PDAL`, also use the gated flow.

## Fork pull requests

1. **Initial gate.** The check named `Initial CI / Linux ARM64 current` runs a
   Debug build and tests on `ubuntu-24.04-arm`. It builds once with Ninja and
   runs CTest directly. Other platform builds remain skipped until approved.
2. **Initial result.** After a successful initial run, the bot posts an
   **Initial CI passed** comment with the tested commit and a link to the run.
   If the gate fails, inspect its logs and push a fix; the full matrix does not
   start.
3. **Maintainer approval.** A maintainer applies `ci:full`. The person applying
   the label must have current Write, Maintain, or Admin access to the target
   repository. Triage access can apply a label but cannot authorize the matrix.
4. **Full matrix.** A new run checks ARM64 again, then runs Pixi, Linux
   (current/fixed), macOS, Windows (current/fixed), Alpine, Conda packages on
   Linux/macOS/Windows, and Docker builds on AMD64/ARM64.
5. **Full result.** The `Full CI` summary succeeds only when every platform
   succeeds. The bot then posts a separate full-success comment for that commit.
   Failed, canceled, skipped, or superseded results do not produce that comment.

An authorized label remains effective for later contributor pushes. Each new
run checks who most recently applied it and whether that person still has write
access. An older approval cannot authorize a later application by someone
without write access. To replace a denied application, a maintainer must remove
and reapply the label.

Each new revision must pass the gate again. Removing `ci:full` returns later runs
to the initial stage, but does not cancel work already started. Other labels do
not start builds or interrupt active runs. A maintainer can rerun a failed
workflow in Actions or remove and reapply `ci:full`. Always check the result for
the latest commit rather than relying on an older success comment.

## Maintainer branches

Branches pushed directly to `PDAL/PDAL` run all platform workflows immediately
and in parallel. They do not wait for the initial ARM64 result or a `ci:full`
label. Same-repository PRs use these push checks; they do not receive the gated
initial/full-success comments. The test-change warning described below still
applies.

Feature-branch Docker builds validate both architectures without publishing
images. Docker publishing remains on `master` and version tags.

## Test-change warnings

The bot maintains a PR comment listing added, modified, deleted, or renamed
files under `test/` and `tests/`. It includes test data and files renamed out of
those directories. The warning is informational and does not fail CI; necessary
tests should still be added or updated with a contribution. Later commits update
the warning, including when the PR no longer changes test files.

## Flow diagrams

```{figure} ../images/ci-flow-old.png
:alt: Previous CI flow: PRs and branch pushes start the full platform matrix immediately.
:width: 100%

The previous flow started all platforms immediately.
```

```{figure} ../images/ci-flow-new.png
:alt: New CI flow: fork PRs pass ARM64 and receive ci:full approval; maintainer branches run all platforms automatically.
:width: 100%

The new flow gates fork PRs while preserving automatic maintainer branch builds.
```

## Dependencies and caching

The initial gate uses `scripts/ci/current-environment.yml`, a cached Conda
environment, and `ccache`. A restored environment skips dependency solving and
installation. Its cache key does not change daily or for code-only commits, so
quick feedback takes priority over selecting the newest dependency packages.
`master` builds populate caches that new PRs can restore.

Changing the environment file refreshes its cache. To deliberately refresh
packages without changing dependency specifications, bump
`cache-environment-key: gate-current-v1` in `.github/workflows/linux-gate.yml`.
Micromamba is pinned because its binary also contributes to the environment key;
changing that version or a cache eviction can require a fresh solve. Package
downloads and compiler output are cached separately.

Linux and Windows also have fixed dependency configurations in the full matrix.
Pixi uses its own environment and `RelWithDebInfo` build; it runs the `test` task
once, which already includes configuration and compilation.

## Configuration and reporting

The workflow definitions are in `.github/workflows`, build scripts and dependency
specifications are in `scripts/ci`, and the comment implementation and its tests
are in `.github/scripts`.

| File | Responsibility |
| --- | --- |
| `pr-ci.yml` | PR event handling, label authorization, platform calls, and the full-success summary. |
| `linux-gate.yml` | Initial ARM64 build, tests, and caches. |
| `pixi.yml`, `linux.yml`, `osx.yml`, `win.yml`, `alpine.yml`, `conda.yml` | Reusable platform builds and standalone upstream push checks. |
| `docker-pr.yml` / `docker.yml` | Read-only PR/feature-branch Docker builds / master and release publishing. |
| `pr-ci-comments.yml` | Test-change warnings and result comments. |

PR builds use read-only permissions and do not receive publishing credentials.
The comment workflow uses trusted default-branch code and GitHub API metadata;
it never checks out PR code or consumes PR artifacts. Its workflow and script
must be present on the target repository's default branch before comments work.
Success comments are updated per commit to avoid duplicates on reruns.

Before deployment, create the `ci:full` label and review required-check names.
Fork PR checks run inside PR CI; maintainer PRs use standalone push job names.
A skipped `Full CI` job is not evidence that the matrix passed. This change
controls scheduling and does not change repository merge protection rules.
Detailed setup and validation instructions are in the [CI operator guide].

## Status and documentation builds

{{ alpinestatus }}  {{ linuxstatus }}  {{ osxstatus }}  {{ windowstatus }}  {{ dockerstatus }}

These badges link to the standalone platform workflows. Use the checks on the
specific PR and commit to assess a contribution's CI result.

Documentation is built separately through Read the Docs using
`.readthedocs.yaml` and `doc/environment.yml`. Skipping build CI for a
`doc/**`-only change does not replace documentation validation. See
{ref}`development-docs` for local documentation builds and preview instructions.

[github actions]: https://github.com/features/actions
[ci operator guide]: https://github.com/PDAL/PDAL/blob/master/.github/CI.md
