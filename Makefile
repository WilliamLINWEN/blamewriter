.PHONY: build lint test test-watch test-coverage test-unit test-integration test-frontend test-frontend-watch test-frontend-coverage test-frontend-unit test-frontend-integration test-all

build:
	npm run build

lint:
	npm run lint

lint-fix:
	npm run lint:fix

test:
	cd backend && npm test

test-watch:
	cd backend && npm run test:watch

test-coverage:
	cd backend && npm run test:coverage

test-unit:
	cd backend && npm test -- --testPathPattern="unit"

test-integration:
	cd backend && npm test -- --testPathPattern="integration"

# Frontend test commands
test-frontend:
	cd frontend && npm test

test-frontend-watch:
	cd frontend && npm run test:watch

test-frontend-coverage:
	cd frontend && npm run test:coverage

test-frontend-unit:
	cd frontend && npm test -- --testPathPattern="unit"

test-frontend-integration:
	cd frontend && npm test -- --testPathPattern="integration"

# Run all tests (backend + frontend)
test-all:
	make test && make test-frontend