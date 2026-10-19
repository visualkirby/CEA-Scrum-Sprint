# CEA Sprint 1 Retrospective

## What went well

- The goal was met by Thu 10/15, three days early. That left room to pull in four more stories without putting the goal at risk.
- Reading the actual Review pile drove the fixes. Real misfiled mail showed the gaps faster than guessing at rules would have, and Review went from 21 threads to 2.
- Every story's done check ran against real incoming mail: 10 of 10 sorts, 5 of 5 log rows, 16 PDFs. Nothing was marked Done on a dry run.

## What didn't go well

- The 10/14 standup was posted on CEA-4 instead of CEA-1.
- Wednesday was a limited-time day with no sprint work, so CEA-4 moved to Thursday.
- The plan doc's 8 carried stories weren't entered at sprint start. They got groomed on 10/16, mid-sprint.

## Lessons

1. **The CEA-5 CI failure came from a test that read the real `.env`.** The `/api/settings` test passed on the local machine because the local `.env` exists, and failed in CI where it doesn't. Commit 61e4595 now overrides `get_base_settings` in the fixture. Rule: tests never depend on the local `.env`. In CEA that file points at prod, so a test that reads it touches prod.
2. **"Wait for CI" was reported as off when it was on.** The claim came from a 09-21 note that nobody re-checked. If it had been true, red builds could have deployed, so it drove real worry. Rule: check a live setting before stating it, and correct the stale note when it's wrong.

## Actions for Sprint 2

- Post each standup on CEA-1 and check the issue key before saving.
- Enter every planned story before clicking Start Sprint.
- Do a rules pass on the newer Review pile (refer.io, Randstad) and decide the CNA rule. This could be its own small story.
