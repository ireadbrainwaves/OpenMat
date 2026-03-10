# Open Mat — UI Overhaul Deploy Package

## What This Is

Complete UI rewrite for the Open Mat Vite app. Drop these files into your existing project at `C:\Users\hpets\Desktop\openmat-vite\openmat\`.

## Files Included

### New Files (add these)
```
src/lib/tokens.js       ← Design tokens (colors, fonts, archetypes)
src/lib/icons.jsx        ← All SVG icons (move types, stances, archetypes)
src/screens/ProfileScreen.jsx  ← New screen
```

### Replaced Files (overwrite these)
```
src/index.css            ← New global styles + animations
src/components/UI.jsx    ← Btn, Bar, GPBar, ChainCounter, BottomNav, Coach, Spinner, Screen
src/screens/AuthScreen.jsx
src/screens/OnboardScreen.jsx
src/screens/HomeScreen.jsx
src/screens/LobbyScreen.jsx
src/screens/DeckScreen.jsx
src/screens/GamePlanScreen.jsx
src/screens/PostMatchScreen.jsx
```

### NOT Included (keep your existing versions)
```
src/lib/supabase.js      ← Keep yours (has sb export, graph cache, getMoves)
src/lib/constants.js     ← Keep yours (some constants moved to tokens.js but no conflicts)
src/lib/botEngine.js     ← Keep yours
src/screens/MatchScreen.jsx  ← Keep yours for now (prototype is in outputs/ for reference)
src/screens/TutorialScreen.jsx  ← Copy from outputs/OpenMat_Tutorial.jsx when ready
src/App.jsx              ← Needs manual update (see below)
```

## Setup Steps

### 1. Install fonts
The new design uses Google Fonts loaded via CSS @import (already in index.css):
- Bebas Neue (display)
- DM Sans (body)
- IBM Plex Mono (data)

### 2. Copy files
```powershell
# From wherever you downloaded this package:
Copy-Item -Force "src/lib/tokens.js" "C:\Users\hpets\Desktop\openmat-vite\openmat\src\lib\"
Copy-Item -Force "src/lib/icons.jsx" "C:\Users\hpets\Desktop\openmat-vite\openmat\src\lib\"
Copy-Item -Force "src/index.css" "C:\Users\hpets\Desktop\openmat-vite\openmat\src\"
Copy-Item -Force "src/components/UI.jsx" "C:\Users\hpets\Desktop\openmat-vite\openmat\src\components\"
Copy-Item -Force "src/screens/*.jsx" "C:\Users\hpets\Desktop\openmat-vite\openmat\src\screens\"
```

### 3. Update App.jsx imports
Add these imports to your existing App.jsx:
```jsx
import ProfileScreen from './screens/ProfileScreen';
// Update BottomNav import if needed:
import { BottomNav } from './components/UI';
```

Add ProfileScreen to your screen router and add it as a nav destination.

### 4. Test
```powershell
cd "C:\Users\hpets\Desktop\openmat-vite\openmat"
npm run dev
```

## Design System Notes

- All colors/fonts come from `tokens.js` — change once, updates everywhere
- All icons come from `icons.jsx` — `<MoveIcon type="submission" size={20}/>`
- Archetype icons: `<ArchIcon id="wrestler" s={28}/>`
- Shared components in `UI.jsx` — `<Btn>`, `<Bar>`, `<GPBar>`, `<Coach>`, `<BottomNav>`
- Zero emojis anywhere
- Minimum font size: 9px

## Prototype Files (for reference)
These are in your outputs/ folder and show the full design vision:
- `OpenMat_Full_Prototype.jsx` — Complete match screen with sub minigame
- `OpenMat_SubMinigame.jsx` — Standalone sub minigame
- `OpenMat_Tutorial.jsx` — Tutorial match (Coach Bot, you lose)
- `OpenMat_Auth_Onboard.jsx` — Auth + onboard prototypes
- `OpenMat_SupportingScreens.jsx` — All 6 supporting screens
