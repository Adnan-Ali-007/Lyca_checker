# Deploy to Oracle Cloud Free Tier (A1 — 4 CPU / 24GB RAM)

## Step 1 — Create Oracle Cloud account
1. Go to https://cloud.oracle.com → Sign Up (free, credit card for identity only, never charged)
2. Pick a home region near your client (UK South, EU Frankfurt, US East, etc.)

## Step 2 — Provision the VM
1. Hamburger menu → Compute → Instances → **Create Instance**
2. **Name**: `lyca-validator`
3. **Image**: Click Edit → Change image → **Ubuntu 22.04 Minimal**
4. **Shape**: Click Edit → Change shape → Ampere → **VM.Standard.A1.Flex**
   - Set OCPUs: `4`  |  Memory: `24 GB`   ← always free maximum
5. **SSH keys**: paste your public key (`cat ~/.ssh/id_ed25519.pub`)
   - Generate one if needed: `ssh-keygen -t ed25519`
6. Click **Create** and wait ~2 min
7. Copy the **Public IP address** shown on the instance page

> **"Out of capacity" error?**  
> Try a different Availability Domain (AD-1, AD-2, AD-3 buttons at the top).  
> If all 3 are full, wait a few hours and try again — it's worth it for 24GB free.

## Step 3 — Open firewall port 80
**Oracle's cloud firewall (must do this or the site won't be reachable):**
1. Instance details page → click the **Subnet** link → **Default Security List** → **Add Ingress Rules**
2. Add rule: Source CIDR `0.0.0.0/0` | Protocol TCP | Port `80`

**Ubuntu's OS firewall (run after SSH in):**
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## Step 4 — SSH into the VM
```bash
ssh ubuntu@YOUR_PUBLIC_IP
```

## Step 5 — Install Docker
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
newgrp docker
# verify:
docker --version
```

## Step 6 — Push your code to GitHub (do this from your local machine first)
```bash
git add .
git commit -m "production ready"
git push
```
Make sure your `.env` is in `.gitignore` — it is already.

## Step 7 — Clone repo on the VM
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

## Step 8 — Create the .env file on the server
```bash
nano .env
```

Paste this — fill in YOUR values:
```ini
MONGO_URI=mongodb+srv://adnanali007:YOUR_PASSWORD@cluster0.fqhmkkg.mongodb.net/lycavalidator?appName=Cluster0
WORKER_COUNT=6
JWT_SECRET=pick-any-long-random-string-here-make-it-64-chars
MAIL_SERVICE=gmail
MAIL_USER=adnanali123456@gmail.com
MAIL_PASS=your-gmail-app-password
ADMIN_EMAIL=adnanali123456@gmail.com
BACKEND_URL=http://YOUR_PUBLIC_IP
FRONTEND_URL=http://YOUR_PUBLIC_IP
```
Save: `Ctrl+O` → Enter → `Ctrl+X`

> WORKER_COUNT=6 is safe on 24GB RAM (uses ~2GB, leaves plenty of headroom).  
> You can push to 10 if you want maximum speed.

## Step 9 — Build and start
```bash
docker compose up -d --build
```
First build takes **5–10 minutes** (downloads packages, builds React, installs Chrome).  
Subsequent restarts are fast (Docker caches layers).

## Step 10 — Verify it's running
```bash
docker compose logs -f app
```
You should see:
```
MongoDB connected
Queue drained — clean start
[worker 0] started
[worker 1] started
...
[worker 5] started
Backend running on port 4000
```
Press `Ctrl+C` to stop watching logs (app keeps running).

## Your live URL
```
http://YOUR_PUBLIC_IP
```
Share this with your client.

---

## Useful commands

```bash
# Watch live logs
docker compose logs -f app

# Pull latest code and redeploy
git pull && docker compose up -d --build

# Stop everything
docker compose down

# Check container status
docker compose ps

# Restart without rebuilding
docker compose restart app
```

## Troubleshooting

**Site not reachable?**  
→ Double-check Oracle security list has port 80 open  
→ Run `docker compose ps` — make sure app shows "Up"  
→ Run `sudo iptables -L INPUT -n | grep 80` — should show ACCEPT rule

**Workers stalling / Chrome crashes?**  
→ Reduce WORKER_COUNT in .env, then `docker compose up -d`

**Email links broken (approve/reject)?**  
→ Make sure `BACKEND_URL` and `FRONTEND_URL` are set to `http://YOUR_PUBLIC_IP` in .env
