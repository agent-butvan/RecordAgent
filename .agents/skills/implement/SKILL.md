---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at established public interfaces or seams already agreed with the user.

Run relevant type checks and tests after a coherent implementation change. Repeat affected checks when new edits, failures, or invalidated evidence justify it. Run the full suite when the integration impact or repository rules require it; preserve mandatory final checks and report any unverified scope.

Once done, use /code-review to review the work.

Commit your work to the current branch.
