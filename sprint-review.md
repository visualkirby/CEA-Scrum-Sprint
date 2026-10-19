# CEA Sprint 1 Review (10/12 to 10/18)

**Sprint goal:** Every job-search email gets sorted and saved to Drive automatically, with no writes to CEA yet. **Met.**

**Committed vs done:** CEA-2, CEA-3 and CEA-4 were committed (10 pts) and finished by 10/15. With the goal met, CEA-9, CEA-11, CEA-10 and CEA-5 were pulled in. 7 of 7 Done, 21 of 21 points.

## What works now

- **CEA-2:** the hourly sorter labeled the 215-thread Job Search backlog; 10 of 10 hand-checked threads were right. Reading the Review pile led to a whitespace/apostrophe fix plus 15 rules, and Review dropped from 21 threads to 2.
- **CEA-3:** every sorted thread gets one Log row, deduped by thread ID. 5 of 5 spot-checked against Gmail.
- **CEA-4:** response emails save as PDFs in Drive company folders. The done check saved 16 with 0 left.
- **CEA-9:** a thread re-sorts when a new message arrives. An employer's interview invite moved from Review to Interview.
- **CEA-11 + CEA-10:** clean folder names, and the company comes from ADP, Workday and iCIMS sender addresses. The refile moved 7 of 19 PDFs out of `_Unsorted` and a folder named after a recruiter.
- **CEA-5:** personal API keys for scripts. First story through a full adversarial review loop; the hardening shipped as b56b1cb, and a key sent in `?token=` now gets a 401.

## Shipped outside the board

- b56b1cb: CEA-5 audit fixes. Leftovers became CEA-20.
- e6addac: Analytics cards follow the selected range. The raw track slugs it exposed became CEA-21.

## Not done / carried

- A rules pass on the newer Review pile (refer.io alerts, Randstad).
- The CNA `check out the job at` rule is still undecided.

## Backlog movement

Grooming added CEA-9 through CEA-21. The backlog holds 12 items going into Sprint 2.
