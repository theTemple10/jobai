# CV builder research and acceptance criteria

Research date: 9 October 2026. ATS-friendly means designed to reduce common parsing problems; it does not mean guaranteed passage, a universal score, or a hiring prediction.

## What informs the design

[Greenhouse's parsing guidance](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) identifies common problems with images, complex layouts, columns, tables, unclear sections, and contact details placed in headers or text boxes. JobAI exports a single column with ordinary paragraphs, familiar headings, contact details in the document body, and real text rather than screenshots. Employers' requested file formats still take precedence.

[Harvard's guidance on AI and application documents](https://careerservices.fas.harvard.edu/ai-resumes-and-cover-letters/) emphasizes authentic candidate facts, relevant skills in context, straightforward formatting, and review of generated wording. The builder begins with user-entered facts or a reviewed imported profile. Its optional summary rewrite receives only the existing summary and must not add claims. AI output remains a suggestion requiring review.

## Choices

- Optional sections cover summary, experience, education, projects, skills, certifications, volunteering, and languages. Entry-level applicants can include evidence beyond paid work.
- No photograph, decorative columns, rating bars, keyword stuffing, fabricated metrics, or invented experience is generated.
- PDF exports use embedded, open-licensed Noto Sans and selectable text. Word exports use normal paragraphs and lists. Plain text provides a transparent fallback.
- All exports share the same document representation as the preview. Disabled sections are omitted from search-profile conversion and export.
- Completeness guidance is a checklist rather than a proprietary ATS score. Tailoring means choosing relevant, supported content; it cannot establish eligibility or employer preference.
- Downloads require the user to review the document and confirm the facts are theirs.
- Draft saving is explicit. A guest may save on the device; a signed-in user may save to the account. Account storage uses Supabase RLS ownership policies.

## What verification proves

Browser checks export real PDF/DOCX files and extract their text back to confirm candidate name, project, and contribution content. Additional checks cover section exclusion, malformed draft data, and profile import. This proves document/text correctness for those fixtures, not compatibility with every commercial ATS.

Before claiming broad compatibility, evaluate a diverse set of representative CVs, names, and writing systems; inspect pagination in exported files; and verify supported parser integrations where access is authorized. Production AI extraction and writing quality also need provider-backed evaluation with consented or synthetic fixtures.

## Next product experiments

Evaluate whether users can identify truthful achievements, correct imported facts, and finish a CV without help. Add job-specific tailoring only with full posting context, explicitly tracked candidate evidence, and review of each proposed change. Never add a skill because a posting requests it.
