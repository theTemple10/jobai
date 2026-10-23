import { emptyResume, normalizeResume } from './resume.js';
import { readStored } from '../../shared/lib/storage.js';
const HANDOFF = 'jobai_auth_handoff';
export function readHandoff() {
  const value = readStored(HANDOFF, null, value => value && typeof value === 'object'
    && typeof value.at === 'number' && Date.now() - value.at < 30 * 60 * 1000 && value.at <= Date.now()
    && value.document && typeof value.document === 'object' && !Array.isArray(value.document));
  return value?.document ? {document: normalizeResume(value.document), cloudId: typeof value.cloudId === 'string' ? value.cloudId : null} : null;
}
export function initialDraft() {
  return readHandoff()?.document || normalizeResume(readStored('jobai_resume_draft', emptyResume()));
}
// Draft recovery must protect all entered facts, including excluded sections
// and guided answers that have not yet been arranged into exportable content.
export function hasDraft(document) {
  const r = normalizeResume(document);
  return ['name', 'title', 'email', 'phone', 'location', 'website', 'summary', 'skills', 'certifications', 'languages'].some(key => r[key].trim())
    || ['experience', 'education', 'projects', 'volunteering'].some(key => r[key].some(row => Object.values(row).some(value => value.trim())))
    || Object.values(r.intake?.notes || {}).some(value => value.trim());
}
export function prepareAuthHandoff(document, cloudId) {
  if (hasDraft(document)) localStorage.setItem(HANDOFF, JSON.stringify({document, cloudId, at: Date.now()}));
}
export function clearHandoff() { try {localStorage.removeItem(HANDOFF);} catch { /* Recovery is optional. */ } }
