.PHONY: install lint typecheck test build mobile-analyze mobile-test mobile-build

install:
	npm install

lint:
	npm run lint

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
