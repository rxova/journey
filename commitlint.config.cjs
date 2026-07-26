module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Length is a review concern, not a machine one. All three are disabled
    // deliberately: `header-max-length` was the explicit 120 in the sibling repos, but
    // config-conventional also enforces 100-character body and footer lines,
    // and those are the ones that actually bite — a pasted stack trace, a long
    // URL or a wrapped explanation in a commit body is not a defect.
    "header-max-length": [0],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "docs",
        "feat",
        "fix",
        "perf",
        "refactor",
        "rename",
        "revert",
        "style",
        "test"
      ]
    ]
  }
};
