# Sprint 1 Standups

Sprint 1: Mon 10/12 to Sun 10/18/2026. Goal: every job-search email gets sorted and saved to Drive automatically, with no writes to Career Engine App yet. Each entry is also posted as a comment on CEA-1 in Jira.

## Tue 10/13

- **Yesterday:** Set up the Jira Scrum space, entered the epic and 7 stories with points and acceptance criteria, started Sprint 1 (10 points).
- **Today:** Move CEA-2 to In Progress, create the CEA-Scrum-Sprint repo, start the hourly sorter.
- **Blockers:** None.

## Wed 10/14

- **Yesterday:** Shipped CEA-2 and CEA-3 (7 of 10 points). The hourly sorter labeled all 215 Job Search threads, and 10 of 10 hand-checked threads were right. The sort log wrote one row per labeled thread (64 rows, 5 of 5 spot-checked against Gmail). Added 15 rules and a whitespace fix after reading the Review pile, which dropped Review from 21 threads to 2.
- **Today:** Read CEA-4's acceptance criteria and draft its design (save each response email as a PDF in Drive).
- **Blockers:** Limited time today, so the CEA-4 build moves to Thursday. Three days left for 3 points.

*Posted on CEA-4 by mistake (Wed 10/14, 8:45 AM) and left there to keep the timestamp; CEA-1 has a pointer note.*

## Thu 10/15

- **Yesterday:** No sprint work. Wednesday was a limited-time day, and the CEA-4 design moved to today.
- **Today:** Design and build CEA-4, then run the done check: 5 real responses saved as readable PDFs in the right company folders.
- **Blockers:** None. Three days left for 3 points.

## Fri 10/16

- **Yesterday:** Built CEA-4. Response emails now save as PDFs to Job Search Responses/<Company> in Drive. The done check passed with 16 PDFs saved and all readable: 10 in the right company folders, 6 in `_Unsorted` (1 via Indeed, 2 via Workday, 2 ADP confirmations).
- **Today:** CEA-4 is Done, so the sprint is at 10 of 10 points. Groomed the backlog. I added 9 stories (19 points) and a Durable job queue epic, rewrote 4 older items with current acceptance criteria and dropped 2 that were already resolved. Three of the new stories (CEA-9 to CEA-11) came out of this week's sorter work: re-sort on a new message, company from ADP/Workday addresses, clean folder names.
- **Blockers:** None. Sprint review and retro on Monday.

## Sat 10/17

- **Yesterday:** Once the sprint goal was met, I pulled CEA-9 and CEA-11 into Sprint 1 and finished both. A thread now gets re-sorted when a new message arrives. That moved an employer's interview invite from Review to Interview. Folder names are clean now, and refileResponses() moves PDFs that were already saved, which fixed a messy multi-brand folder name. I also added CEA-10 and CEA-5 to the sprint.
- **Today:** CEA-10 is built and pushed. ADP, Workday and iCIMS senders now get the company from the address ("GlobexHealth.hr@adp.com" becomes Globex Health, and an iCIMS address becomes the employer's name). A Node test of 21 real addresses passed. Still to do: switch the Senders rows, preview, and refile the 5 PDFs out of `_Unsorted` and a folder named after a recruiter. CEA-5 (personal API key) starts after that.
- **Blockers:** None.
