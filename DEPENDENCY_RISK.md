# Dependency Risk Assessment

The following risks have been identified in the current project's dependency structure:

## High Risk

- **Unpinned Backend Dependencies**: `requirements.txt` does not specify version numbers for major packages like `fastapi`, `uvicorn`, `pydantic`, `sqlalchemy`, etc. This leads to non-deterministic environments and "works on my machine" bugs.
- **Celery / Redis / RQ**: These packages are marked for total removal in the migration plan. Code depending on them will break if not refactored simultaneously with their removal.

## Medium Risk

- **Tailwind CSS v4-alpha**: Currently using an alpha release (`4.0.0-alpha.25`). While powerful, alpha software is subject to breaking changes and lacks documentation parity with stable versions. Migration to the stable v4.0.0 is required.
- **Python 3.14.3**: This is a very recent/bleeding-edge release. Ensure that all standard libraries and compiled dependencies (like `pydantic-core`, `psycopg2`, `bcrypt`) are fully compatible and stable on this version.

## Low Risk

- **Supabase JS CLI v2.103.0**: Significantly ahead of some stability baselines, but generally stable in the 2.x range.
- **React 18.3.1**: To be upgraded to React 19. Minor breaking changes in refs and some lifecycle behaviors might occur.

## Proposed Mitigations

1. **Immediate version pinning**: Transition to `uv` and `pyproject.toml` to lock all dependencies.
2. **Standardization**: Replace alpha/beta versions with stable releases.
3. **Audit**: Run `uv sync` to verify compatibility across the dependency graph.
