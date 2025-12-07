#!/bin/bash

uv run ruff format
npx prettier . --write 
