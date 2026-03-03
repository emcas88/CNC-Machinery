## Summary

<!-- Provide a concise description of what this PR does and why. -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing functionality to change)
- [ ] Refactor (no functional change, code quality improvement)
- [ ] Documentation update
- [ ] CI/CD or infrastructure change
- [ ] Dependency update

## Related Issues

<!-- Link to relevant GitHub issues. Use "Closes #<issue>" to auto-close on merge. -->

Closes #

## Changes Made

<!-- List the specific changes included in this PR. Be concise. -->

- 
- 
- 

## How to Test

<!-- Step-by-step instructions to verify the change works as intended. -->

1. 
2. 
3. 

## Screenshots / Recordings

<!-- If applicable, add screenshots or a short screen recording. Delete this section if not relevant. -->

## Checklist

### General
- [ ] I have read and followed the [Contributing Guidelines](../CONTRIBUTING.md)
- [ ] My branch is up to date with `main`
- [ ] Commit messages are clear and follow the project convention
- [ ] No debug code, `console.log`, or `dbg!` left in the diff

### Code Quality
- [ ] `make fmt-check` passes (formatting verified)
- [ ] `make lint` passes (no Clippy / ESLint warnings)
- [ ] `make check` passes (fmt + lint combined)

### Tests
- [ ] `make test` passes locally
- [ ] New code has corresponding unit / integration tests
- [ ] Coverage remains at or above **85%** (`make coverage-check`)
- [ ] Edge cases and error paths are covered

### Database (if applicable)
- [ ] Migration files are included and reversible
- [ ] `make migrate` runs cleanly on a fresh database
- [ ] Down migrations (`make migrate-revert`) have been verified

### Documentation
- [ ] Public API / functions are documented with doc-comments
- [ ] `README.md` or relevant docs updated if behaviour changed
- [ ] `CHANGELOG.md` entry added (if applicable)

### Security
- [ ] No secrets, credentials, or PII committed
- [ ] New dependencies reviewed for known vulnerabilities (`cargo audit` / `npm audit`)
- [ ] Input validation / sanitisation added for any new endpoints

## Deployment Notes

<!-- Describe anything the reviewer or deployer needs to know:
     new environment variables, feature flags, manual migration steps, etc.
     Delete this section if not applicable. -->

N/A

## Reviewer Notes

<!-- Anything you want reviewers to pay special attention to? -->
