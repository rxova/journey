// @changesets/changelog-github has no option to suppress the attribution line.
// `disableThanks: true` sat in this repo's config for months and did nothing —
// it is not a recognised option, and getReleaseLine appends `Thanks ${users}!`
// unconditionally. Wrapping the generator is the only way to drop the line while
// keeping the pull-request and commit links, which are the part worth having.
//
// Resolution: changesets calls resolveFrom(<repo>/.changeset, changelog[0]), so
// the config value is "./changelog-no-thanks.cjs" — relative to .changeset/,
// not to the repo root.
//
// Re-verify after any @changesets/changelog-github bump: this rewrites a
// rendered string, so a change to its output format makes it a silent no-op
// rather than an error. `pnpm exec changeset version` on a throwaway branch,
// then grep the changelogs for "Thanks", is the check.
const github = require("@changesets/changelog-github").default;

// Upstream builds the segment as ` Thanks ${users}!` where `users` is a
// comma-joined list, so the trailing group is required — matching a single
// linked user leaves `, [@second](url)!` stranded on the line.
const ATTRIBUTION = / Thanks \[@[^\]]+\]\([^)]+\)(?:, \[@[^\]]+\]\([^)]+\))*!/g;

// When attribution was the *only* prefix component (a changeset carrying an
// `author:` line that no commit backs yet), removing it leaves `- - summary`.
// Upstream emits the separator before we get the string, so it has to be
// collapsed here rather than avoided.
const EMPTY_PREFIX = /^(\n\n)- - /;

module.exports = {
  ...github,
  getReleaseLine: async (changeset, type, options) =>
    (await github.getReleaseLine(changeset, type, options))
      .replace(ATTRIBUTION, "")
      .replace(EMPTY_PREFIX, "$1- ")
};
