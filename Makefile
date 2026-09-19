.PHONY: install lint format format-check typecheck test build mobile-analyze mobile-test mobile-build infra-up infra-down infra-test-up infra-test-down

install:
	npm install

lint:
	npm run lint

format:
	npm run format

format-check:
	npm run format:check

typecheck:
	npm run typecheck

test:
	npm run test

build:
	npm run build

mobile-analyze:
	npm run mobile:analyze

mobile-test:
	npm run mobile:test

mobile-build:
	npm run mobile:build

infra-up:
	npm run infra:up

infra-down:
	npm run infra:down

infra-test-up:
	npm run infra:test:up

infra-test-down:
	npm run infra:test:down
