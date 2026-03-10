# Open Mat — Vite + React Setup

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (hot reload)
npm run dev

# 3. Build for production
npm run build

# 4. Deploy to GitHub Pages
npm run deploy
```

## Project Structure

```
openmat/
├── index.html              # HTML shell (minimal)
├── vite.config.js          # Vite config (base path for GH Pages)
├── package.json
├── src/
│   ├── main.jsx            # Entry point
│   ├── App.jsx             # Root component + screen router
│   ├── index.css           # Global styles + design tokens
│   ├── lib/
│   │   ├── supabase.js     # Supabase client, graph cache, debug
│   │   └── constants.js    # Archetypes, colors, belt configs
│   ├── components/
│   │   └── UI.jsx          # Shared components (Nav, Btn, Card, etc)
│   └── screens/
│       ├── AuthScreen.jsx
│       ├── OnboardScreen.jsx
│       ├── HomeScreen.jsx
│       ├── LobbyScreen.jsx
│       ├── MatchScreen.jsx
│       ├── ResultScreen.jsx
│       ├── DeckScreen.jsx
│       └── GymScreen.jsx
└── public/                 # Static assets (favicon, etc)
```

## Adding New Screens

1. Create `src/screens/YourScreen.jsx`
2. Import in `src/App.jsx`
3. Add routing logic in the App component

## Deploying

The `npm run deploy` command builds and pushes to the `gh-pages` branch.
Your site will be live at: `https://ireadbrainwaves.github.io/OpenMat/`

## Migrating from Single-File

This project was migrated from a single `index.html` file with CDN React + Babel.
The Vite setup gives you:
- **Hot module reload** — changes appear instantly
- **Real imports** — no more 1000+ line files
- **Tree shaking** — smaller production builds
- **Source maps** — easier debugging
- **npm packages** — proper dependency management
