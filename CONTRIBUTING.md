# Contributing to Kasia

First off, thanks for participating on this awesome project that Kasia is ❤️.
All types of contributions are encouraged and valued, we really mean it.

Any contributions through pull requests are welcome as this project aims to be a community based project.

## Branches

`master` is currently the default branch, and that's from where https://kasia.fyi is being sourced from. It is expected to be a stable version.

`staging` is where the next release is being packaged, it is expected to be unstable.

## Discussions

Currently, questions, bugs and suggestions should be reported through GitHub issue tracker.\
For less formal discussions there is also a [Discord Server](https://discord.gg/Z5jU6jp6Vs).

## Coding style

Inherited from default prettier settings, subject to evolution. We recommend that you add the `prettier` extension on your favorite IDE, and enable format on save capability.\
For VsCode user, this is automatically done through .vscode workspace settings.

## Coding guide

### Web style

For any new implementations, we enforce the use of inline TailwindCSS. A well-known utility `clsx` is available within the codebase for more conplex style application (e.g.: conditional style)

## Submitting Changes

Kasia uses GitHub's pull-request workflow and all contributions in terms of code should be done through pull requests.\
If the change is considered an "hotfix" (something to be shipped right away), please target the `master` branch, otherwise `staging`.

Anyone interested in Kasia may review your code. One of the core developers will merge your pull request when they think it is ready. For every pull request, we aim to promptly either merge it or say why it is not yet ready; if you go a few days without a reply, please feel free to ping the thread by adding a new comment.

To get your pull request merged sooner, you should explain why you are making the change.

Also, do not squash your commits after you have submitted a pull request, as this erases context during review. We will squash commits when the pull request is merged.
