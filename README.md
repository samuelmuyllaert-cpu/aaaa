# ChatBotKit Whitelabel Dashboard

Een whitelabel dashboard voor klanten om hun ChatBotKit chatbots te beheren.

## Features

- 🤖 Chatbots beheren (aanmaken, backstory bewerken)
- 📁 Dataset beheer (bestanden uploaden, tekst records toevoegen)
- 💬 Conversaties bekijken

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- ChatBotKit Partner API

## Installatie

1. Clone de repository
2. Kopieer `.env.example` naar `.env` en vul je API keys in:

```bash
cp .env.example .env
```

3. Installeer dependencies:

```bash
npm install
```

4. Start de development server:

```bash
npm run dev
```

## Environment Variables

| Variable | Beschrijving |
|----------|-------------|
| `VITE_CHATBOTKIT_API_KEY` | Je ChatBotKit API key |
| `VITE_CHATBOTKIT_USER_ID` | ChatBotKit sub-account ID van de klant |
| `VITE_COMPANY_NAME` | Naam van het bedrijf (optioneel) |
| `VITE_SUPABASE_URL` | Supabase URL (optioneel, voor auth) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (optioneel) |

## Deployment

### Bolt / Vercel / Netlify

1. Connect je GitHub repository
2. Stel environment variables in via dashboard
3. Deploy!

## API Proxy (Development)

De Vite config bevat een proxy voor ChatBotKit API calls om CORS issues te voorkomen:

```javascript
// vite.config.ts
proxy: {
  '/api/chatbotkit': {
    target: 'https://api.chatbotkit.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/chatbotkit/, ''),
  },
}
```

Voor productie moet je een server-side proxy configureren of ChatBotKit's CORS settings aanpassen.

## Licentie

MIT
