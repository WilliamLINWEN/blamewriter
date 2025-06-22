.PHONY: build lint test test-watch test-coverage test-unit test-integration

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