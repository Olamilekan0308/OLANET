# OLANET Vercel setup

The repository is a monorepo. The frontend lives in `skillhub`; the API lives in `api-server`.

Recommended Vercel setup:
- Create/import the project from GitHub repository `Olamilekan0308/OLANET`.
- Set the Vercel Root Directory to `skillhub` for the frontend deployment.
- Keep Supabase/OpenAI secrets in Vercel Environment Variables, never in frontend source.
- The existing API server can remain separately deployed or be adapted to Vercel Functions after the frontend preview is verified.
