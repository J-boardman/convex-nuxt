# Changesets

Package-facing pull requests include a changeset. Run `pnpm changeset`, select
the public package whose behavior changed, and describe the user-visible
result. The fixed group in `config.json` keeps both public packages on the same
version even when only one package changed.

Documentation-only, test-only, and internal maintenance changes normally do
not need a changeset.
