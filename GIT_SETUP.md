# Git Setup Guide for Windows

Git is not currently installed on your system. Follow these steps to install Git and set up your repository.

## Step 1: Install Git for Windows

### Option A: Using Git for Windows (Recommended)

1. **Download Git for Windows**:
   - Go to [https://git-scm.com/download/win](https://git-scm.com/download/win)
   - Download the latest version (64-bit recommended)

2. **Run the installer**:
   - Double-click the downloaded `.exe` file
   - Follow the installation wizard with these recommended settings:
     - **Select Components**: Keep all default options
     - **Default editor**: Choose your preferred editor (VS Code recommended if installed)
     - **PATH environment**: Select "Git from the command line and also from 3rd-party software"
     - **HTTPS transport**: Use the OpenSSL library
     - **Line ending conversions**: Checkout Windows-style, commit Unix-style
     - **Terminal emulator**: Use MinTTY
     - Keep other default settings

3. **Verify installation**:
   - Open a **new** Command Prompt or PowerShell window
   - Run: `git --version`
   - You should see something like: `git version 2.x.x`

### Option B: Using GitHub Desktop (Easier for Beginners)

1. **Download GitHub Desktop**:
   - Go to [https://desktop.github.com/](https://desktop.github.com/)
   - Download and install

2. **Sign in to GitHub**:
   - Open GitHub Desktop
   - Sign in with your GitHub account

3. **GitHub Desktop includes Git**, so you can use it for GUI operations

## Step 2: Configure Git

After installing Git, configure your identity:

```bash
# Set your name
git config --global user.name "Your Name"

# Set your email (use your GitHub email)
git config --global user.email "your.email@example.com"

# Verify configuration
git config --list
```

## Step 3: Initialize Repository

Navigate to your project directory and initialize Git:

```bash
# Navigate to project
cd c:\Users\natta\OneDrive\Documents\Workspace\moltbot

# Initialize Git repository
git init

# Check status
git status
```

## Step 4: Connect to GitHub Repository

```bash
# Add remote repository
git remote add origin https://github.com/mzget/cloudflare-moltbot-playgroud.git

# Verify remote
git remote -v
```

## Step 5: Make Initial Commit

```bash
# Add all files (respects .gitignore)
git add .

# Check what will be committed
git status

# Commit with a message
git commit -m "Initial commit: Add CI/CD workflows and documentation"

# Push to GitHub
git push -u origin main
```

**Note:** If the `main` branch doesn't exist on GitHub yet, you might need to create it first or use a different branch name.

## Step 6: Verify on GitHub

1. Go to [https://github.com/mzget/cloudflare-moltbot-playgroud](https://github.com/mzget/cloudflare-moltbot-playgroud)
2. You should see all your files
3. Check the **Actions** tab to see if workflows are detected

## Alternative: Using GitHub Desktop

If you prefer a GUI approach:

1. **Open GitHub Desktop**
2. **Add existing repository**:
   - File → Add Local Repository
   - Choose: `c:\Users\natta\OneDrive\Documents\Workspace\moltbot`
3. **Publish repository**:
   - Click "Publish repository"
   - Uncheck "Keep this code private" if you want it public
   - Or connect to existing repository: Repository → Repository Settings → Add remote

## Common Git Commands

Once Git is installed, here are useful commands:

```bash
# Check status
git status

# Add files
git add .
git add <specific-file>

# Commit changes
git commit -m "Your commit message"

# Push to GitHub
git push

# Pull latest changes
git pull

# Create new branch
git checkout -b feature/new-feature

# Switch branches
git checkout main

# View commit history
git log --oneline

# View remote repositories
git remote -v
```

## Troubleshooting

### Git not recognized after installation

**Solution:**
1. Close and reopen your terminal/command prompt
2. If still not working, restart your computer
3. Verify Git is in PATH: `echo %PATH%` should include Git's bin directory

### Permission denied (publickey)

**Solution:**
1. Set up SSH keys: [GitHub SSH Guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
2. Or use HTTPS with personal access token

### Repository already exists

**Solution:**
If the GitHub repository already has content:
```bash
# Pull first
git pull origin main --allow-unrelated-histories

# Then push
git push -u origin main
```

## Next Steps

After Git is set up:

1. ✅ Install Git for Windows
2. ✅ Configure Git with your name and email
3. ✅ Initialize repository
4. ✅ Add remote repository
5. ✅ Make initial commit
6. ✅ Push to GitHub
7. ✅ Configure GitHub Secrets (see [DEPLOYMENT.md](./DEPLOYMENT.md))
8. ✅ Test CI/CD workflows

## Resources

- [Git for Windows](https://git-scm.com/download/win)
- [GitHub Desktop](https://desktop.github.com/)
- [Git Documentation](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [Pro Git Book (Free)](https://git-scm.com/book/en/v2)
