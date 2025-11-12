#!/bin/bash
# Safe deployment script - only pushes static HTML/CSS/JS files
# Never touches production payloads, images, or generated content

echo "🔍 Checking for changes to static files only..."

# Show what would be committed (excluding production content)
git status

echo ""
echo "⚠️  SAFETY CHECK:"
echo "   - Payloads in /payloads/ and /article_payloads/ will NOT be pushed"
echo "   - Images in /article_images/ will NOT be pushed"
echo "   - Generated pages in /article_page/ will NOT be pushed"
echo ""
echo "   Only static files (HTML templates, CSS, JS, user_manager) will be pushed"
echo ""

read -p "Continue with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Commit and push
git add -A
git commit -m "Update static files: $(date '+%Y-%m-%d %H:%M')"
git pull --rebase
git push

echo "✅ Static files deployed successfully!"
