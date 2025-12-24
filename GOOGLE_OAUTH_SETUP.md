# Google OAuth Setup Guide

This guide will help you set up Google Sign-In for your application.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click "New Project"
4. Enter a project name (e.g., "MarketBot")
5. Click "Create"

### 2. Enable Google+ API

1. In the Google Cloud Console, select your project
2. Go to "APIs & Services" > "Library"
3. Search for "Google+ API"
4. Click on it and press "Enable"

### 3. Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Select "External" (unless you have a Google Workspace)
3. Click "Create"
4. Fill in the required information:
   - **App name**: Your application name (e.g., "MarketBot")
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click "Save and Continue"
6. On the "Scopes" page, click "Save and Continue"
7. On the "Test users" page, you can add test users if needed, then click "Save and Continue"
8. Review and click "Back to Dashboard"

### 4. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application"
4. Enter a name (e.g., "MarketBot Web Client")
5. Under "Authorized JavaScript origins", add:
   - `http://localhost:3000` (for development)
   - Your production URL (e.g., `https://yourdomain.com`)
6. Under "Authorized redirect URIs", add:
   - `http://localhost:3000/auth/google/callback` (for development)
   - `https://yourdomain.com/auth/google/callback` (for production)
7. Click "Create"
8. Copy the **Client ID** and **Client Secret** - you'll need these!

### 5. Update Environment Variables

1. Open your `.env` file (create one if it doesn't exist, based on `.env.example`)
2. Add the following variables:

```env
# Enable/disable Google OAuth (set to true to show Google sign-in buttons)
ALLOW_GOOGLE_CONNECTION=true
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"
```

Replace `your-client-id` and `your-client-secret` with the values from step 4.

**Note:** Set `ALLOW_GOOGLE_CONNECTION=false` to hide all Google OAuth UI elements if you haven't configured Google OAuth credentials yet.

### 6. Test the Integration

1. Start your development server: `npm run dev`
2. Navigate to the login page
3. Click "Sign in with Google"
4. You should be redirected to Google's sign-in page
5. After signing in, you'll be redirected back to your application

## Production Deployment

When deploying to production:

1. Update the OAuth consent screen with your production domain
2. Add your production domain to "Authorized JavaScript origins"
3. Add your production callback URL to "Authorized redirect URIs"
4. Update the `GOOGLE_CALLBACK_URL` environment variable in your production environment

## Troubleshooting

### "Error 400: redirect_uri_mismatch"

This error occurs when the redirect URI doesn't match what's configured in Google Cloud Console.

**Solution**: Make sure the `GOOGLE_CALLBACK_URL` in your `.env` file exactly matches one of the "Authorized redirect URIs" in your Google Cloud Console credentials.

### "Access blocked: This app's request is invalid"

This can happen if the OAuth consent screen is not properly configured.

**Solution**: Go back to the OAuth consent screen settings and ensure all required fields are filled in.

### Users can't sign in

If you're using "External" user type and the app is in testing mode, only test users can sign in.

**Solution**: Either add users to the test users list, or publish your app (go to OAuth consent screen and click "Publish App").

## Security Best Practices

1. **Never commit your `.env` file** to version control
2. Use different OAuth credentials for development and production
3. Keep your `GOOGLE_CLIENT_SECRET` secure
4. Regularly rotate your credentials
5. Set appropriate session timeouts
6. Use HTTPS in production

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [remix-auth Documentation](https://github.com/sergiodxa/remix-auth)
- [remix-auth-google Documentation](https://github.com/pbteja1998/remix-auth-google)
