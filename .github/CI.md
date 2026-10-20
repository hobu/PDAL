# Pull request CI

PRs that change only files under `doc/` skip PR CI. Other opened, reopened, or
updated fork PRs first run a Linux Debug build and tests on `ubuntu-24.04-arm`.
Maintainer branches pushed directly to `PDAL/PDAL` use automatic push CI as
described below. When testing this change on a fork such as `hobu/PDAL`, PRs from
that fork's own branches also use the gated flow.
PRs mixing documentation and other changes follow the normal gating process.
The gate uses the existing Linux CMake configuration,
`scripts/ci/current-environment.yml`, and `ccache`.
The complete solved Conda environment is cached with a stable versioned key;
cache hits skip dependency solving and installation, even on later days. The gate
prioritizes reusing working dependencies over picking up every package release.
It configures and builds once, then invokes CTest directly. Master pushes also run
the ARM64 gate to populate caches that new PRs can restore. Installation, examples, standalone plugin
rebuilds, and the second locale test pass remain in the full matrix. A successful
initial run posts an **Initial CI passed** comment with the tested head SHA and
run link.

Pixi runs in the full matrix with its `RelWithDebInfo` setup. The workflow invokes
only its `test` task, which already depends on configure/build, to avoid a second
compilation. The gate uses the faster Debug configuration and compiler caching
while retaining the basic Linux build's test coverage.
Standard ARM64 and x64 GitHub-hosted runners are both free for public repositories;
the gate uses the standard ARM64 runner, not a paid larger runner.

The environment cache automatically changes when `current-environment.yml`
changes. Micromamba is pinned because the setup action also includes its binary
hash in the cache key. To refresh dependencies deliberately, bump
`cache-environment-key: gate-current-v1` in `linux-gate.yml` (for example, to
`gate-current-v2`). Changing the pinned Micromamba version or a GitHub cache
eviction can also require a fresh solve. Package downloads and compiled objects
are cached separately. The environment cache key has no date, commit SHA, or PR
number; master builds populate caches that other PRs can restore, while a PR's
own caches benefit later runs of that PR within GitHub's cache access rules.

After reviewing that result, someone with **Write, Maintain, or Admin** repository
access applies the **`ci:full`** label. GitHub also lets Triage users apply labels,
so PR CI explicitly checks repository permissions before allowing the full matrix.
Create this repository label before using the gate:

```sh
gh label create ci:full --repo OWNER/PDAL --color 0E8A16 \
  --description "Run all CI platforms after Linux ARM64 passes"
```

An authorized label application starts a new run, which rechecks ARM64 and then
runs Pixi, Linux (current/fixed), macOS, Windows (current/fixed), Alpine, Conda (three platforms),
and Docker (AMD64/ARM64). The **Full CI** job succeeds only when every platform
succeeds. A second bot comment reports full success. Failures, cancellation,
skipped platforms, and results for an older PR head never produce a full-success
comment.

The label remains effective for subsequent pushes, including contributor pushes:
each new run verifies who most recently applied it and that they still have write
access. An older authorized application cannot approve a later unauthorized
reapplication. A denied label must be removed and reapplied by someone with write
access. Missing label history or unavailable permission data never authorizes the
matrix. This check uses read-only API metadata without checking out PR code.

Each new revision must pass ARM64 before its full matrix starts. Remove the label
to return subsequent runs to the initial stage; removing it does not cancel work
already started. Labels other
than `ci:full` do not start builds or interrupt active runs. To retry a failure,
rerun the workflow in Actions, or remove and reapply `ci:full`.

The bot also maintains a warning listing added, modified, deleted, or renamed
paths under `test/` (PDAL's test tree) and `tests/`. Renames out of those directories
are included. Test data changes count too. If later commits remove those changes,
the warning is updated. Large lists are truncated with a notice.

## Maintainer branch pushes

Pushes to branches in `PDAL/PDAL` automatically run the ARM64 build and the full
platform matrix in parallel. No PR, initial-gate result, or `ci:full` label is
required. The existing platform workflows provide the push checks. Docker uses
the read-only `Docker CI` workflow for feature branches; publishing remains
limited to `master` and version tags.

PRs whose source and target repositories are both `PDAL/PDAL` use those push
checks and skip the gated PR builds, avoiding duplicate runs. They do not receive
the initial/full-success comments from PR CI; their results are in the push
checks. Test-file warning comments still run for these PRs. The existing
`dependabot/**` push exclusion is preserved, so those PRs still use the gated
flow even when their source branch is in `PDAL/PDAL`.

Documentation-only pushes under `doc/` skip build CI. Feature-branch pushes to
forks do not start builds independently; their PRs use the gate. Fork `master`
and tag builds retain their existing triggers. GitHub may show skipped standalone
workflow runs on fork feature branches, but they allocate no build runners.

## Permissions and deployment

PR builds use read-only repository permissions and no publishing credentials.
Docker PR builds never publish images. Existing Docker publishing continues on
`master` and version tags. Standalone platform workflows also run on upstream
maintainer branches as described above.

The comment workflow uses `pull_request_target` for file warnings and
`workflow_run` for results. It checks out only the repository's default branch,
reads GitHub API metadata, and never executes PR code or consumes PR artifacts.
GitHub must have this workflow and its script on the **default branch** before
comments work, including during fork testing. No personal access token is needed.
Success comments are updated per head SHA, avoiding duplicates on reruns.

The initial check is named `Initial CI / Linux ARM64 current`. Existing branch protection rules
may need updating after deployment: fork PRs use jobs called from PR CI, while
upstream maintainer PRs use standalone push checks with different job names.
A skipped `Full CI` check is not proof of a full run: GitHub treats skipped
jobs as passing for required checks. This change controls CI scheduling; it does
not modify repository merge rules.

## Validation

Run the reporting tests with:

```sh
node --test .github/scripts/*.test.cjs
actionlint
```

For live testing, use a PR in `hobu/PDAL` with this change on the fork's default
branch. Confirm only ARM64 builds initially, inspect the initial-success comment,
apply `ci:full`, then verify all platforms and the full-success comment. Exercise
an unrelated label, a new commit, a failed initial build, and changes/renames under
both test directory spellings. To validate upstream branch scheduling without
pushing upstream, use a disposable fixture branch with simulated builds and
substitute `hobu/PDAL` for the upstream repository checks only in that fixture.
Confirm automatic push builds, no duplicate same-repository PR builds, and the
documentation/Dependabot exclusions. Restore the fork's original default branch after
testing. Only push branches to `hobu`; prepare the upstream PR after validation.
