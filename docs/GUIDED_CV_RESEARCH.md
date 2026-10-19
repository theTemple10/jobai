# Reducing repetitive CV entry

Reviewed 2026-10-19 using official product guidance:

- [Teal: import a resume or LinkedIn profile](https://help.tealhq.com/en/articles/9457699-import-existing-resume-or-linkedin-profile): importing establishes a reusable starting profile instead of retyping an entire history.
- [Teal: build your resume](https://help.tealhq.com/en/articles/14435724-how-to-build-your-resume-in-teal): build a foundation, then improve individual positions and tailor documents.
- [Rezi: AI bullet points](https://www.rezi.ai/rezi-docs/ai-bullet-points): context-specific writing assistance helps with individual achievements.
- [Enhancv: AI resume builder](https://enhancv.com/ai-resume-builder/): upload/import and assisted drafting reduce blank-page work.

Our synthesis: offer existing-document import first-class access, collect only relevant categories, use role and skill choices where they avoid typing, ask one short factual question at a time, and separate drafting from approval. These are observed design patterns, not evidence of a guaranteed conversion improvement.

## Implemented flow

Role choice → relevant category checkboxes → one short note per category → explicitly selected skills → name/optional email → arrange original words or request AI wording → review → section editor/export → job discovery.

Guest users can arrange notes and download documents without a provider or an account. The manual editor remains available. Users can explicitly save unfinished answers on their device; automatic saving is opt-in. Keeping the underlying structured CV supports later editing without repeating the intake.

AI receives only target role, selected skills, and selected notes, with explicit consent. Contact fields are excluded, although a person can include identifying information in their own notes. The server validates category, size, and skill limits. The client preserves identity/selected skills, strips unsupported structured labels, rejects new numeric claims, and retains original notes when the model omits a selected section. These checks cannot prove factual accuracy: paraphrases can still be wrong, and numbers written as words are not comprehensively verified. A visible review remains required before downloads.

The draft operation uses Groq JSON-object output, with a server-selected text model. Current reference: [Groq GPT-OSS 120B](https://console.groq.com/docs/model/openai/gpt-oss-120b). Model availability and actual response quality still require a live acceptance test.

## Next evidence to collect

Watch first-time users attempt an import and a first CV. Measure completion/drop-off per step, time to a reviewed export, how often they correct draft claims, and whether they can find relevant jobs. Collect feedback with consent; do not send CV text or personal notes into analytics. Consider optional voice notes or reusable experience entries only after this baseline works well. LinkedIn scraping and automatic application submission are not implemented.
