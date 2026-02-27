# How to Deploy SecureVault (Free & Permanent)

Follow these steps to put your notepad online so you can access it from anywhere in the world.

### 1. Put the Code on GitHub
1. Create a free account on [GitHub.com](https://github.com).
2. Create a new "Private Repository" called `my-secure-vault`.
3. In your `cloud-encrypted-notes` folder on your computer, run:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_LINK_HERE
   git push -u origin main
   ```

### 2. Connect to Render
1. Create a free account on [Render.com](https://render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub account and select the `my-secure-vault` repository.
4. **Settings**:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
5. Click **Deploy**.

### 3. Your New Link
Render will give you a link like `https://securevault-xxxx.onrender.com`.
- **Phone**: Open this link, type your code, and "Add to Home Screen".
- **Access**: This link will work 24/7 without needing your computer to be turned on.

### ⚠️ Security Reminder
Because this is "End-to-End Encrypted," Render **cannot** read your notes even though they host the server. Your **Security Code** is only known by you. If you lose your Security Code, your notes are lost forever (even I cannot recover them).
