# Unified operator interface for the ce-pattern-kit repository.

default:
  @just --list

# --- Bash helpers ---------------------------------------------------------

[private]
_require_cmd := '''
  require_cmd() {
    command -v "$1" >/dev/null 2>&1 || {
      printf 'Required command not found: %s\n' "$1" >&2
      exit 1
    }
  }
'''

# --- Recipe helpers -------------------------------------------------------

# Run one root package script.
[private]
_pnpm_run SCRIPT:
  #!/usr/bin/env bash
  set -euo pipefail
  {{ _require_cmd }}

  require_cmd pnpm
  pnpm run {{ quote(SCRIPT) }}

# --- Workspace ------------------------------------------------------------

# Install exactly what the committed lockfile specifies.
install_frozen: (_pnpm_run 'install:frozen')

# Resolve dependencies and permit the lockfile to change.
install_unlock: (_pnpm_run 'install:unlock')

# Run every repository check.
check: (_pnpm_run 'check')

# Check justfile formatting
check_justfile_format:
  @just --fmt --check --indentation '  '

# Format every file Prettier and markdownlint own.
format:
  #!/usr/bin/env bash
  set -euo pipefail
  {{ _require_cmd }}

  require_cmd pnpm
  pnpm run format
  pnpm run format:markdown

# Unstage every WORKING_NOTES.md and WORKING_NOTES.*.md so a commit never carries one.
unstage_working_notes:
  #!/usr/bin/env bash
  set -euo pipefail
  {{ _require_cmd }}

  require_cmd git
  git diff --cached --name-only -z -- ':(glob)**/WORKING_NOTES.md' ':(glob)**/WORKING_NOTES.*.md' \
    | while IFS= read -r -d '' path; do
        git reset -q -- "${path}"
        printf 'unstaged %s\n' "${path}" >&2
      done

# --- Kit ------------------------------------------------------------------

# Type-check the scripts, the checker, and the tools.
typecheck: (_pnpm_run 'check:types')

# Run every unit test with the Node test runner.
test: (_pnpm_run 'test')

# Classify and type-check the golden example under examples/react-shadcn.
check_example: (_pnpm_run 'check:example')

# Regenerate the golden example from the install scripts; layer files and barrels are kept.
regenerate_example: (_pnpm_run 'regenerate:example')

# Copy src/scripts and src/assets into the install skill.
sync_skill_assets: (_pnpm_run 'sync:skill-assets')

# Fail when the install skill's bundled copy differs from src.
check_skill_assets: (_pnpm_run 'check:skill-assets')

# --- Dependencies ---------------------------------------------------------

# Scan the workspace lockfile for known vulnerabilities with osv-scanner.
scan_dependencies:
  #!/usr/bin/env bash
  set -euo pipefail
  {{ _require_cmd }}

  require_cmd osv-scanner
  osv-scanner scan source --lockfile pnpm-lock.yaml --config osv-scanner.toml

# Scan the lockfile; warn instead of failing when the OSV API is unreachable.
scan_dependencies_or_warn:
  #!/usr/bin/env bash
  set -euo pipefail
  {{ _require_cmd }}

  require_cmd osv-scanner
  stderr_file="$(mktemp)"
  trap 'rm -f "${stderr_file}"' EXIT
  set +e
  osv-scanner scan source --lockfile pnpm-lock.yaml --config osv-scanner.toml 2>"${stderr_file}"
  status=$?
  set -e
  if [[ "${status}" -eq 127 ]] && grep -qE 'error when retrieving vulns|request failed|dial tcp|no such host|i/o timeout|TLS handshake' "${stderr_file}"; then
    printf 'warning: osv-scanner could not reach the OSV API; continuing without a vulnerability scan.\n' >&2
    exit 0
  fi
  cat "${stderr_file}" >&2
  exit "${status}"

# Validate renovate.json with Renovate's config validator.
check_renovate_config:
  #!/usr/bin/env bash
  set -euo pipefail
  {{ _require_cmd }}

  require_cmd renovate-config-validator
  renovate-config-validator renovate.json
