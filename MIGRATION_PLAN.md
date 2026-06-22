# Migration Plan: Luminar Modernization

This document outlines the phased approach to modernize the Luminar platform.

## Phase 1: Dependency & Environment (Low Effort, Medium Risk)
**Goal**: Establish a stable, deterministic environment.
- [ ] Initialize `uv` project.
- [ ] Create `pyproject.toml` and pin all dependencies.
- [ ] Upgrade Python to 3.12 (standardizing on a stable long-term release).
- [ ] Implement `pydantic-settings` BaseSettings in `app/core/config.py`.

## Phase 2: Core Backend Engine (Medium Effort, High Risk)
**Goal**: Modernize the FastAPI application core.
- [ ] Reorganize to new directory structure (`app/core/`, `app/api/v1/`, etc.).
- [ ] Migrate SQLAlchemy models to 2.0 style and async sessions.
- [ ] Migrate Pydantic models to v2 (field_validators, model_dump).
- [ ] Implement APScheduler and delete Celery/Redis/RQ code.
- [ ] Implement Loguru and RequestIDMiddleware.

## Phase 3: Frontend Foundation (Medium Effort, Medium Risk)
**Goal**: Upgrade the frontend stack and theme engine.
- [ ] Upgrade React to v19 and Vite to v6.
- [ ] Migrate to stable Tailwind CSS v4.
- [ ] Perform a full wipe and reinstall of shadcn/ui (Zinc/New York).
- [ ] Implement `next-themes` and flash prevention script in `index.html`.

## Phase 4: Component & Route Audit (High Effort, Low Risk)
**Goal**: Compliance with strict architectural rules.
- [ ] Refactor all components to remove hardcoded colors.
- [ ] Enforce strict TypeScript types (no `any`).
- [ ] Update all routes to use TanStack Router file-based routing.
- [ ] Ensure all API calls are typed and validated with Zod.

## Phase 5: CI/CD & Validation (Medium Effort, Low Risk)
**Goal**: Ensure quality and regression testing.
- [ ] Create GitHub Actions workflow (`ci.yml`).
- [ ] Integrate Ruff, Mypy, and Pytest with 80% coverage check.
- [ ] Setup Playwright for visual regression testing.

## Summary of Risk & Effort

| Phase | Effort | Risk | Impact |
| :--- | :--- | :--- | :--- |
| Phase 1 | Low | Medium | Environment stability |
| Phase 2 | Medium | High | Breaking changes in backend logic |
| Phase 3 | Medium | Medium | UI consistency and build speed |
| Phase 4 | High | Low | Code quality and maintainability |
| Phase 5 | Medium | Low | Long-term reliability |
