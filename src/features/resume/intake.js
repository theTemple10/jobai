export const INTAKE_KINDS = [
  {id:'experience',label:'Work or an internship',hint:'Paid, freelance, family-business, or internship work.',question:'Tell us about something you did at work.',prompt:'What did you do, where did you do it, and what changed? Include a role, organisation, or dates only if you know them.'},
  {id:'projects',label:'A project I worked on',hint:'Coursework, personal projects, or something you helped build.',question:'What did you make or help with?',prompt:'Tell us what it was, what you contributed, and any tools or results you can describe. A course or personal project counts.'},
  {id:'education',label:'Education or training',hint:'A degree, course, apprenticeship, or practical training.',question:'What have you studied or learned?',prompt:'Name the qualification or training, the place you learned, and the year if you know it. Add a relevant subject or piece of coursework if useful.'},
  {id:'volunteering',label:'Community or volunteer work',hint:'Helping a group, organising an event, mentoring, or service.',question:'Who did you help, and how?',prompt:'Tell us the group or community, what you did, and any outcome you know. Formal titles and numbers are optional.'},
  {id:'summary',label:'I’m still finding my starting point',hint:'Interests, practice, or abilities you can explain in your own words.',question:'What would you like an employer to know about you?',prompt:'Describe what you enjoy doing, what you have practised, and what you hope to work on. You don’t need to invent a job or qualification.'},
];
export const ROLE_SUGGESTIONS = ['Frontend developer','Data analyst','Customer support','Project coordinator','Digital marketer','Administrative assistant'];
const SKILLS = {
  frontend:['HTML','CSS','JavaScript','React','Git','Accessibility'],
  data:['Microsoft Excel','SQL','Python','Power BI','Data cleaning','Research'],
  customer:['Customer service','Communication','Problem solving','Email support','CRM tools'],
  project:['Planning','Coordination','Documentation','Microsoft Excel','Communication'],
  market:['Content writing','Social media','Research','Analytics','Canva'],
  admin:['Microsoft Excel','Organisation','Scheduling','Documentation','Communication'],
};
export function skillSuggestions(role) {
  const key = Object.keys(SKILLS).find(key => role.toLowerCase().includes(key));
  return SKILLS[key] || ['Communication','Research','Writing','Microsoft Excel','Problem solving','Organisation'];
}
export function normalizeIntake(value) {
  if (!value || typeof value !== 'object' || value.version !== 1) return null;
  return {
    version:1, completed:value.completed === true,
    stage:Number.isInteger(value.stage) ? Math.max(0,Math.min(9,value.stage)) : 0,
    selected:INTAKE_KINDS.map(kind=>kind.id).filter(id=>Array.isArray(value.selected) && value.selected.includes(id)),
    notes:Object.fromEntries(INTAKE_KINDS.map(({id})=>[id,typeof value.notes?.[id] === 'string' ? value.notes[id].slice(0,3000) : ''])),
  };
}
export function emptyIntake() {return normalizeIntake({version:1,selected:[],notes:{}});}

export function validateDraftFacts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Please provide your role, selected skills, and short notes.');
  if (typeof value.role !== 'string' || !value.role.trim() || value.role.length > 150) throw new Error('Choose a target role shorter than 150 characters.');
  if (!Array.isArray(value.skills) || value.skills.length > 50 || value.skills.some(skill=>typeof skill !== 'string' || skill.length > 100)) throw new Error('Please use up to 50 short skill names.');
  if (!value.notes || typeof value.notes !== 'object' || Array.isArray(value.notes) || Object.keys(value.notes).some(key=>!INTAKE_KINDS.some(kind=>kind.id === key))) throw new Error('Choose the experience categories for your notes.');
  const notes = {};
  for (const [key,note] of Object.entries(value.notes)) {
    if (typeof note !== 'string' || note.length > 3000) throw new Error('Keep each answer to 3,000 characters or fewer.');
    if (note.trim()) notes[key] = note.trim();
  }
  if (!Object.keys(notes).length) throw new Error('Add at least one note about your experience before asking for a draft.');
  return {role:value.role.trim(),skills:[...new Set(value.skills.map(skill=>skill.trim()).filter(Boolean))],notes};
}
