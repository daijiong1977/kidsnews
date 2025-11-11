# User Manager Frontend

This directory contains the frontend JavaScript for user subscription and activity tracking.

## Files

### `user_manager.js`
Main JavaScript client for:
- User registration modal
- Email verification
- Token recovery
- Stats synchronization with server
- localStorage management

### `user_manager.css`
Styling for registration modal and user interface elements

## Integration

This code will be integrated into:
- `website/index.html` (main page)
- `website/article_page/article.html` (article pages)

## API Endpoints Used

- `POST /api/user/register` - Register new user
- `POST /api/user/token` - Recover token by email
- `POST /api/user/sync-stats` - Sync activity stats
- `GET /api/verify?token=xxx` - Email verification

## Development

Test in this directory first, then deploy to website/ when ready.

**Important:** Always backup HTML templates before modifying:
```bash
cp website/index.html website/index.html.backup_$(date +%Y%m%d_%H%M%S)
cp website/article_page/article.html website/article_page/article.html.backup_$(date +%Y%m%d_%H%M%S)
```
