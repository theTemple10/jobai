// The working identity is deliberately centralized while naming is evaluated.
export const BRAND = {
  name: 'RoleAide',
  supportEmail: import.meta.env?.VITE_SUPPORT_EMAIL || '',
  tagline: 'A little help. Your next role.',
  description: 'Build an ATS-friendly CV, explore jobs, and prepare applications with your own experience. A thoughtful career workspace by Philos Digital Labs.',
  siteUrl: (import.meta.env?.VITE_PUBLIC_SITE_URL || 'https://jobai-orpin.vercel.app').replace(/\/$/, ''),
};
