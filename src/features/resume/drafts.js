import { emptyResume, normalizeResume, resumeBlocks } from './resume.js';
import { readStored } from '../../shared/lib/storage.js';
const HANDOFF = 'jobai_auth_handoff';
export function readHandoff() {
  const value = readStored(HANDOFF, null, value => value && typeof value === 'object' && Date.now() - value.at < 30 * 60 * 1000 && value.at <= Date.now());
  return value?.document ? {document: normalizeResume(value.document), cloudId: typeof value.cloudId === 'string' ? value.cloudId : null} : null;
}
export function initialDraft() {
  return readHandoff()?.document || normalizeResume(readStored('jobai_resume_draft', emptyResume()));
}
export function hasDraft(document) { return resumeBlocks(document).length > 0; }
export function prepareAuthHandoff(document, cloudId) {
  if (hasDraft(document)) localStorage.setItem(HANDOFF, JSON.stringify({document, cloudId, at: Date.now()}));
}
export function clearHandoff() { try {localStorage.removeItem(HANDOFF);} catch { /* Recovery is optional. */ } }
