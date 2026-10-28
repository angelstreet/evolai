# TASK-AJ — From a survey to an audit

Owner decision 2026-10-28, after the gap review `docs/FABLE_REVIEW_2026-10-28.md`: build the evidence chain the
audit lacks. The owner accepted the review's five recommendations: task inventory in the survey (A5), visit notes
now (A6), no quotes in the client report, no waiting for an AI route (A1 to A9 use none), and keep questionnaire
v1 for a mission whose survey opens before A4 and A5 are done. A1 to A4 first; decisions in ADR 0058.

| #   | Step                              | Done when                                                                                                                                                                                                                  | State             |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| A1  | Findings written from answers     | Answers tab: tick free texts and choices, "Write a finding", saved approved with its evidence; findings listed on the Report tab with people counts; under 5 people "staff only"; the report and client read the new table | done (2026-10-28) |
| A2  | Rule proposals                    | `proposeFindings` proposes choice, unsure and free-text pattern findings for a team of 12 (unit test); "Propose findings" saves them as drafts in the mission's language                                                   | done (2026-10-28) |
| A3  | Findings become actions           | Approving a finding of 5 or more people creates its opportunity and the report proposes catalogue actions with a "Why" line; withdrawing archives it (`findings.spec.ts`)                                                  | done (2026-10-28) |
| A4  | Fix the score                     | Weight 0 is not scored; `v1_repeat_time` weight 0; the sentence under the score names the axes it rests on (unit tests)                                                                                                    | done (2026-10-28) |
| A5  | Task inventory (questionnaire v2) | The repeated task, how often, how long, which tool, which data; counted per team in the brief; feeds A2                                                                                                                    | to do             |
| A6  | Visit notes                       | A Visit tab where staff write anonymised notes; a finding can cite a note                                                                                                                                                  | to do             |
| A7  | "Ask on site" prompts             | The printed brief lists what to ask per finding                                                                                                                                                                            | to do             |
| A8  | Referent confirms findings        | The referent confirms or disputes findings before publishing                                                                                                                                                               | to do             |
| A9  | Baseline and day 90               | Each action has a baseline and a day-90 measure                                                                                                                                                                            | to do             |
| A10 | Model-drafted findings            | Only behind a contract-approved route                                                                                                                                                                                      | waits on a route  |

Production: migration `0029_findings.sql` applied to Neon on 2026-10-28 (owner approval): the three tables with
row-level security, and `v1_repeat_time` unscored on the existing question items.
