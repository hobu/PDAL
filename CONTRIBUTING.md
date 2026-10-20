# How to contribute

PDAL welcomes all contributions.
We use Github's [pull requests](https://help.github.com/articles/using-pull-requests) to accept patches from the community.

## Getting Started

* Make sure you have a [GitHub account](https://github.com/signup/free).
* Fork the repository on GitHub.

## Making Changes

* Create a topic branch from where you want to base your work.
  * You usually should base your topic branch off of the master branch.
  * To quickly create a topic branch: `git checkout -b my-topic-branch`
* Make commits of logical units.
* Check for unnecessary whitespace with `git diff --check` before committing.
* Make sure your commit messages are in the [proper format](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html).
* Make sure you have added the necessary tests for your changes.
* [Run _all_ the tests](https://pdal.org/project/testing.html) to assure nothing else was accidentally broken.

## Submitting Changes

* Push your changes to a topic branch in your fork of the repository.
* Submit a pull request to the repository in the PDAL organization.
  * If your pull request fixes/references an issue, include that issue number in the pull request. For example:

```
Wiz the bang

Fixes #123.
```

* PDAL developers will look at your patch and take an appropriate action.

## What to Expect from CI

Pull requests use two stages of continuous integration (CI) to provide quick
feedback before running every platform. Pull requests that change only files
under `doc/` skip PR CI. Changes outside that directory, including documentation
elsewhere in the repository, follow the normal CI flow.

1. **Initial check:** Opening, reopening, or updating a pull request first runs
   `Initial CI / Linux ARM64 current`, a Linux ARM64 Debug build and test suite.
   This check reuses cached Conda dependencies and compiler output to reduce build
   time. When it passes, a bot posts an **Initial CI passed** comment with the
   tested commit and a link to the run. The other platform checks are skipped
   until a maintainer approves the full run; this is expected.
2. **Maintainer approval:** After reviewing the initial result, a maintainer
   applies the `ci:full` label. The person applying it must have Write, Maintain,
   or Admin access to the repository. A label applied by someone without write
   access does not authorize full CI. A maintainer handles this step for external
   contributors.
3. **Full check:** Applying an authorized label starts a new run that checks
   ARM64 again, then runs Pixi, Linux, macOS, Windows, Alpine, Conda packaging, and
   Docker builds. The `Full CI` check succeeds only when every platform passes.
   A second bot comment reports that the full matrix passed and identifies the
   tested commit.

When you push more commits, the new revision must pass the initial check again.
If an authorized `ci:full` label remains on the pull request, the full matrix
follows automatically; you do not need a new label application for each update.
Removing the label returns later runs to the initial stage. Success comments for
earlier commits do not establish that your latest revision has passed.

If a check fails, open its logs from the pull request's checks or the linked
Actions run, then push a fix to the same branch. The full matrix will not start
if the initial check fails. If a failure appears unrelated to your changes, ask
a maintainer to review it and rerun CI if appropriate.

The bot also posts a warning listing changed files under `test/` or `tests/`,
including test data, deleted files, and files renamed out of those directories.
This warning helps reviewers identify test changes; it does not fail CI. Add or
update tests as needed and explain the intended behavior in your pull request.

Passing CI is part of review; maintainers still review your changes before
merging. See the [CI workflow details](.github/CI.md) for more information.

## Additional Resources

* [PDAL's coding conventions](https://pdal.org/project/conventions.html)
* [General GitHub documentation](http://help.github.com/)
* [GitHub pull request documentation](http://help.github.com/send-pull-requests/)
* [PDAL Element Room](https://matrix.to/#/#pdal:osgeo.org)

## Acknowledgements

The basic skeleton of this CONTRIBUTING file was lifted directly from [Puppet's](https://github.com/puppetlabs/puppet/blob/master/CONTRIBUTING.md).
