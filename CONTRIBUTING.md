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

## UI Contributions

Some guidelines and notes on where we want to take the initial (current) Kasia design system.

### UI Stack & Styling

- **TailwindCSS** is the **preferred styling approach**.  
  All new UI code must be written in Tailwind.

- There is legacy **CSS in the codebase**, but we are actively migrating.  
  If you're touching a CSS-based component, you're encouraged to **convert it to Tailwind** (and more if you have the time).


### Alerts & Notifications

- Use the in-house **Toast system** for user alerts and messages.  
  Do not use external libraries or implement custom solutions. If you have a a better idea, lets discuss in discord.


### Icons & Assets

- We mostly use:
  - **Heroicons**
  - Some additional SVG and images for Kasia and Kaspa content

### Component Architecture

#### Headless UI

- **Available for building complex UI** (e.g., dropdowns, pullovers, textareas etc).
- Use it when native or in-house alternatives don’t meet the complexity needs.

#### Common Components

We are building a growing set of shared, reusable components.

Currently available:

- **Modal**  
  - Provides structural shell and exit button  
  - Consumers pass modal body as a child
- **Button**
  - Provides `primary` and `secondary` styles

If you're building a reusable UI element, check if a common component already exists. If not, consider generalizing it.

### Design & Theming

- There is **no formal design system theme set** in place yet.
- Color usage can be inconsistent across the app, but look around anad try to mimic what you see. There should but not much of a reason to implement new colours *yet*.
- We welcome contributions toward a standardized color system or theme guide.

## Submitting Changes

Kasia uses GitHub's pull-request workflow and all contributions in terms of code should be done through pull requests.\
If the change is considered an "hotfix" (something to be shipped right away), please target the `master` branch, otherwise `staging`.

Anyone interested in Kasia may review your code. One of the core developers will merge your pull request when they think it is ready. For every pull request, we aim to promptly either merge it or say why it is not yet ready; if you go a few days without a reply, please feel free to ping the thread by adding a new comment.

To get your pull request merged sooner, you should explain why you are making the change **and** how a reviewer can test it. For visual changes, please include before-and-after screenshots when possible.

Also, do not squash your commits after you have submitted a pull request, as this erases context during review. We will squash commits when the pull request is merged.
