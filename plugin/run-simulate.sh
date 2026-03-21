#!/usr/bin/env bash
set -e
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"
node_modules/.bin/tsx tests/simulate.ts "$@"
