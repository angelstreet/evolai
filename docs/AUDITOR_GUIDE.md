# Auditor guide: run an audit from start to finish

For the owner and auditors. Plain steps in the app, in the order you do them. The why behind each rule is in
[AUDIT_WORKFLOW.md](AUDIT_WORKFLOW.md); commands that need a terminal are in [RUNBOOK.md](RUNBOOK.md).

You work in **Missions**. A mission has five tabs: **Overview, Team, Answers, Report, Settings**. The account menu
holds the workspace settings (members, data and erasure, audit trail). The organisation you work on is chosen in
the header and stays chosen.

## Before the survey

1. **Agree the basics with the client** (outside the app): who is controller, retention, the approved AI route,
   who the referent is. Nothing real goes in before the processing agreement is signed.
2. **Settings** (in the mission): language, dates, teams and their size, the privacy notice (fill it before the
   survey goes out) and the **names to hide**: the client's company name, product names and the names of people who
   might be mentioned in answers. They are hidden before any model sees the text and refused in the published report.
3. **Team**: for each team the app made **one survey address**, for example `https://www.evolai.io/s/demo-sales`.
   You can change its ending and enter the team size. Set the contact person and the reminder days.
4. **Team, Referent**: press **Send the welcome email**. The referent gets one message with two buttons: "Learn the
   audit in 10 minutes" and "Open my space". The second opens their space on a phone with no password; it works once
   and for 30 days. If no email can be sent from the app, copy the address shown and send it yourself, and press
   **Send again** if it was lost or already used. The referent sees counts and approved results only, never who
   answered.

## What the referent does

The referent opens **My space** and sees one card per team: the team address in big type, a QR code, **Share with
the team** (a ready message in French or English with the address, Copy and WhatsApp; the platform sends nothing)
and **See the questions**. Everybody in the team uses the same address; the first visit in a browser starts the
survey, and the same browser comes back to its own answers. The referent can enter the team size, follows
"N of M answered" (words instead of figures under 5 people), sends one **reminder** on the day we suggest, and reads
the report when it is published.

## What the survey asks (questionnaire v1)

About 7 minutes, 10 questions, in French or English, on a phone. Every question can be skipped. The wording is the
same for everyone and never hints at a right answer.

- **Six short choice questions** about what the person usually does in a situation: an AI answer with no source,
  client data and a public assistant, how they word a request, where they would start to simplify a report made by
  hand, copying the same data every day, and the weekly time spent on tasks that come back the same way. Each has an
  honest "I don't know / It depends" option, which is not scored and does not lower the readiness score.
- **Three optional free-text questions** (400 characters, a live counter, "No names, emails or numbers: we mask them
  automatically"): the repetitive task that took the most time last week, the tool or information that was missing
  this week, and the one thing an assistant could help with. These are what the analysis turns into themes and draft
  opportunities, each with the person's own words as the citation. Names, emails, phone numbers and the words on
  your "Names to hide" list are masked before the text is saved.
- **One optional role question**: the area the person works in, in seven broad categories. There is no seniority
  question and no free text: in a team of fewer than 5, area plus seniority could point to one person. Results by
  area only appear for groups of 5 or more.

The optional mascot quiz after the survey does not grade anyone. It gives a mascot that describes a pace or a
habit, never a level.

To change the questions, see [RUNBOOK.md](RUNBOOK.md), "Change the questions". The French wording needs one read
by a native speaker before the pilot (ADR 0046).

## While people answer

5. Follow progress on **Team** and **Overview** (per team, groups under 5 people are not shown as exact numbers).
   The referent sends one generic reminder; nobody is chased by name. **Answers** is the number of finished surveys;
   the size you or the referent entered only sets the "of M" part.

## Review

6. **Findings** (from 5 answers): in the Report tab, "Propose findings" reads the answers and proposes findings
   (weaker practices chosen by 3 people or more, questions many people were unsure about, problems named in the
   free texts), each with the people behind it. Approve what you stand behind, reject the rest. In the Answers
   tab you can also tick free texts and choices and "Write a finding" yourself. An approved finding of 5 people
   or more gets suggested actions under Actions; under 5 people it stays internal. No AI is used (ADR 0058).

## Build the audit report

7. **Report**: press "Start the report" on the audit. The app proposes up to three improvement steps for each
   approved opportunity, taken from a catalogue (simplify, automate, train, AI assistant, data and tools, rules),
   with a line saying why each was proposed.
8. For each step: **Accept**, **Reject**, or the pencil to **Edit** effort, impact, risk, the owner (a role,
   such as "Team lead", never a person's name) and when (30, 60 or 90 days). "From the catalogue" adds another
   catalogue step; "Write my own" adds yours. "Suggest again" covers opportunities approved later.
9. **Executive summary**: "Write a first draft" fills it from the score, the most raised findings and the first
   steps. Rewrite it in your own words for the sponsor. Tick the findings it rests on: every claim keeps its
   source. No names, no quotes from answers. If the owner ran the AI draft, it shows as "AI draft, not reviewed";
   "Use this draft" copies it in, and you still edit it.
10. **Readiness score**: nothing to do. It is computed from the survey answers per axis (knowledge, use,
    conditions), each counting for a third, shown with what the level means, and per team only when at least 5
    people answered.
11. **Next 30, 60 and 90 days**: "Build from the accepted steps", then edit, add or remove lines. Each horizon ends
    with a checkpoint (check use, measure early results, keep, adapt or stop).
12. Fill **Risks** (one per line) and check the **Method and privacy** note.

## Check and publish

13. "Mark ready for review", then **Preview as the client**. You see exactly what the client will see, or the
    reason it is not ready (for example: no finding ticked, a name from the list, words copied from an answer).
14. **Publish** and confirm. The referent now sees it in the **Report** tab of their space and can download the
    PDF. Download it yourself from the editor to send it to the sponsor.
    You can publish with findings alone (no improvement step). If the audit has no approved opportunity, use
    **Write my own** under Improvement steps: give a title, effort, impact, owner and timing. A warning shows when
    fewer than 5 people answered: the score and themes are hidden below 5. The **Method and privacy** note is
    written from the real counts and never says something was approved when it was not.
15. To change a published report, "Start a new version": the client keeps the published version until you
    publish the new one. "Unpublish" removes it from the client at once.

Every step above is written to the **Audit trail** (who, when, what), without the report text.

## After the report

16. Follow the 30/60/90-day checkpoints with the sponsor. Pilot tracking and measured benefits in the app are a
    later phase; until then, keep the measures with the client and start a new report version if the plan changes.
17. Retention and erasure requests: workspace **Settings, Data and erasure**.
