# MEM Fragment Board System — V1 Simulation

Interactive simulation engine for the MEM Fragment Board puzzle system.

## Features
- 6 premade boards with verified Hamiltonian paths + visual guide
- 4 editable player archetypes (change badge counts and re-run)
- Progressive board system (fragments consumed across boards 1→6)
- Perfect Clear tracking (16/16 + Hamiltonian) vs Full Board (16/16 only)
- Combo badge sensitivity analysis
- 120 iterations per archetype, statistical breakdowns

## Deploy to Vercel (Free Account) — Step by Step

### Prerequisites
- A GitHub account (free): https://github.com
- A Vercel account (free): https://vercel.com (sign up with GitHub)
- Git installed on your computer
- Node.js 18+ installed: https://nodejs.org

### Step 1: Create a GitHub Repository
1. Go to https://github.com/new
2. Name it `mem-fragment-simulation`
3. Set it to **Public** or **Private** (both work)
4. Click **Create repository**

### Step 2: Push This Code to GitHub
Open your terminal and run these commands one by one:

```bash
# Navigate into the project folder
cd mem-sim-vercel

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "MEM Fragment Board Simulation v1"

# Connect to your GitHub repo (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/mem-fragment-simulation.git

# Push
git branch -M main
git push -u origin main
```

### Step 3: Deploy on Vercel
1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Find your `mem-fragment-simulation` repo and click **Import**
4. Vercel auto-detects Vite — leave all settings as default:
   - Framework Preset: **Vite**
   - Build Command: `vite build`
   - Output Directory: `dist`
5. Click **Deploy**
6. Wait ~30 seconds — done! You'll get a URL like `mem-fragment-simulation.vercel.app`

### Step 4: Share the Link
Your simulation is now live. Share the Vercel URL with your team.
Any colleague can change archetype inventories directly in the browser and re-run the simulation.

### Updating the Simulation
After making code changes locally:
```bash
git add .
git commit -m "Updated simulation"
git push
```
Vercel automatically redeploys on every push. Takes ~20 seconds.

## Local Development
```bash
npm install
npm run dev
```
Opens at http://localhost:5173

## How the Simulation Works

### Progressive Board System
- Player attempts boards 1 through 6 in order
- Fragments placed on a board STAY on that board (consumed)
- Remaining fragments carry to the next board
- When fragments run out, player stops — but partial boards still earn points

### Scoring
| Element | Points |
|---------|--------|
| C/D Straight (connected) | 10 |
| C/D Straight (disconnected) | 5 |
| A/B Corner (connected) | 15 |
| A/B Corner (disconnected) | 7 |
| S T-piece (connected) | 25 |
| S T-piece (disconnected) | 12 |
| 4-notch Rare (connected) | 40 |
| 4-notch Rare (disconnected) | 20 |
| Full Board (16/16 filled) | +50 |
| Perfect Clear (Hamiltonian) | +100 |
| Combo connection | +15 each |

### Perfect Clear vs Full Board
- **Full Board**: All 16 slots filled — any configuration. Earns +50 bonus.
- **Perfect Clear**: All 16 slots filled AND a continuous Hamiltonian path from entry to exit through all tiles. Earns +50 (full board) + +100 (Hamiltonian) = +150 bonus.
