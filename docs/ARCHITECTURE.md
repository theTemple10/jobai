# Source organization

```
src/
  main.jsx                 Browser entry point
  app/                     App shell, navigation, cross-feature session state
  features/
    resume/                CV intake, editing, document model, parsing and exports
    jobs/                  Job search, preparation, activity and job normalization
    account/               Sign-in, workspace and Supabase client queries
    marketing/             Landing, public information and daily encouragement
  shared/
    components/            Public layout, icons and recovery boundary
    lib/                   Brand, request helpers and device-storage utilities
    styles/                Global theme and product styles
api/                       Vercel function entry points (paths stay stable)
server/                    Server identity, quotas and provider operations
supabase/migrations/       Database schema and row ownership policies
tests/                     Model, API, database and browser acceptance tests
scripts/                   Public-page build, SEO and configuration checks
```

Keep behavior and pure model helpers with their feature. Shared modules contain cross-feature services or presentation, not a second copy of feature logic. Existing device/database keys, API URLs, and project identifiers remain stable when files move. Public-page generation imports the marketing feature directly and never loads personal CV state.
