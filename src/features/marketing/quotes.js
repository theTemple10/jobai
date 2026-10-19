// Original encouragements, avoiding fabricated attribution and licensing issues.
export const ENCOURAGEMENTS = [
  'You do not need to have every answer to take your next step.',
  'A small, honest improvement is still progress.',
  'Your experience deserves clear words. Start with what you know.',
  'An unfinished draft is a beginning, not a verdict.',
  'One thoughtful application can be a good day’s work.',
  'You are allowed to learn as you go.',
  'A rejection does not erase the work you have done.',
  'Make room for rest. Your search can continue tomorrow.',
  'Tell the truth about your strengths. There is value in them.',
  'Begin with one thing you helped make better.',
  'Your next step can be smaller than you think.',
  'Consistency can be quiet. Keep going at your own pace.',
];

export function dailyEncouragement(date = new Date()) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return ENCOURAGEMENTS[((day % ENCOURAGEMENTS.length) + ENCOURAGEMENTS.length) % ENCOURAGEMENTS.length];
}
