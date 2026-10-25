# AI Instructions

This file is the source of truth for any AI assistant working in this repository.
Every rule below MUST always be followed.

## Main focus

The main focus of this codebase is clean code that is very easy to read and follow,
because the same coding patterns are used everywhere.

## Writing code

- Follow the KISS principle (Keep It Stupid Simple).
- Use the same coding patterns that already exist in the codebase.
- Do not create tight coupling between components.
- Variable and function names must be self-descriptive.
- Only add a comment when the code cannot express something on its own.
  Every comment must be short and concise.

## Before implementing

- Check if another part of the code already does the same thing. If it does, reuse it.
- Check the installed libraries before implementing something yourself
  (`go.mod` for the backend, `web/package.json` for the frontend).
- Never use a library without reading its documentation first.

## After implementing

- Test the change thoroughly, including edge cases.

## Frontend (`web/`)

- Everything must follow Bulma design.
- Use as little custom CSS as possible.
- If there is a form, using modular-forms (`@modular-forms/solid`) is paramount.

## Never invent

- Never invent anything that was not explicitly asked for.
- If something is not clear or not specified, ask the developer.
