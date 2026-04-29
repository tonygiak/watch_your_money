# Top-level Makefile for the Greek e-receipt finance app.
#
# Quality-gate contract: `make check` is the definition of done for delivery
# sprints. See `.agents/rules/quality-gate.md` and AGENTS.md §4.7.
#
# Cross-platform: detects Windows via the OS env var so the Python venv path
# resolves correctly under both PowerShell/cmd and POSIX shells.

ifeq ($(OS),Windows_NT)
    PYTHON          := python
    VENV_PYTHON     := backend/.venv/Scripts/python.exe
    BACKEND_VENV_PY := .venv\Scripts\python.exe
    NPM             := npm.cmd
    NULL_REDIR      := > NUL 2>&1
else
    PYTHON          := python3
    VENV_PYTHON     := backend/.venv/bin/python
    BACKEND_VENV_PY := .venv/bin/python
    NPM             := npm
    NULL_REDIR      := > /dev/null 2>&1
endif

# Force UTF-8 + plain pip output so Greek path characters never hit cp1252.
export PYTHONUTF8 := 1
export PYTHONIOENCODING := utf-8
export PIP_DISABLE_PIP_VERSION_CHECK := 1
export PIP_NO_COLOR := 1
export PIP_PROGRESS_BAR := off

.PHONY: help install install-backend install-mobile \
        run-backend run-mobile \
        test test-backend test-mobile \
        lint lint-backend lint-mobile \
        typecheck typecheck-backend typecheck-mobile \
        build check ci clean

help:
	@echo "Targets:"
	@echo "  install         - install backend (.venv + pip) and mobile (npm) deps"
	@echo "  run-backend     - start FastAPI dev server"
	@echo "  run-mobile      - start the mobile app (Expo wired in next sprint)"
	@echo "  test            - run all tests (backend + mobile)"
	@echo "  lint            - run linters"
	@echo "  typecheck       - run static type checkers"
	@echo "  build           - build both runtimes (no-op until next sprint)"
	@echo "  check           - install + lint + typecheck + test (definition of done)"
	@echo "  ci              - alias for check"
	@echo "  clean           - remove caches and the backend venv"

# ---------------------------------------------------------------------------
# install
# ---------------------------------------------------------------------------
install: install-backend install-mobile

install-backend:
	$(PYTHON) -m venv backend/.venv
	$(VENV_PYTHON) -m pip install --quiet --upgrade pip
	$(VENV_PYTHON) -m pip install --quiet -r backend/requirements-dev.txt

install-mobile:
	cd mobile && $(NPM) install --no-audit --no-fund

# ---------------------------------------------------------------------------
# run
# ---------------------------------------------------------------------------
run-backend:
	cd backend && $(BACKEND_VENV_PY) -m uvicorn app.main:app --reload --port 8000

run-mobile:
	cd mobile && $(NPM) run start

# ---------------------------------------------------------------------------
# test
# ---------------------------------------------------------------------------
test: test-backend test-mobile

test-backend:
	cd backend && $(BACKEND_VENV_PY) -m pytest

test-mobile:
	cd mobile && $(NPM) test --silent

# ---------------------------------------------------------------------------
# lint
# ---------------------------------------------------------------------------
lint: lint-backend lint-mobile

lint-backend:
	cd backend && $(BACKEND_VENV_PY) -m ruff check .

lint-mobile:
	cd mobile && $(NPM) run lint --silent

# ---------------------------------------------------------------------------
# typecheck
# ---------------------------------------------------------------------------
typecheck: typecheck-backend typecheck-mobile

typecheck-backend:
	cd backend && $(BACKEND_VENV_PY) -m mypy app tests

typecheck-mobile:
	cd mobile && $(NPM) run typecheck --silent

# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
build:
	@echo "build: backend has no compile step; mobile build wired in next sprint"

# ---------------------------------------------------------------------------
# check / ci
# ---------------------------------------------------------------------------
check: install lint typecheck test
	@echo ""
	@echo "make check: green"

ci: check

# ---------------------------------------------------------------------------
# clean
# ---------------------------------------------------------------------------
clean:
	-$(PYTHON) -c "import shutil, os; shutil.rmtree('backend/.venv', ignore_errors=True); shutil.rmtree('backend/.pytest_cache', ignore_errors=True); shutil.rmtree('backend/.mypy_cache', ignore_errors=True); shutil.rmtree('backend/.ruff_cache', ignore_errors=True); shutil.rmtree('mobile/node_modules', ignore_errors=True)"
