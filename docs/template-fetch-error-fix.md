# Template Fetch Error Fix

## Problem Description

When submitting data from the school side, you're getting this error:

```
Error details: 
Object { 
  templatePath: "schools/school/template.jpg", 
  photoName: "1.png", 
  photoType: "image/png", 
  errorMessage: "Failed to fetch template: ", 
  userSchoolId: "school", 
  hasDb: true, 
  hasStorage: true, 
  environment: "production" 
}
```

## Root Cause

The error occurs because the **Firebase Admin SDK is not properly configured in production**. Specifically, the `FIREBASE_ADMIN_CREDENTIALS` environment variable is missing or not set correctly.

## Why This Happens

1. **Development vs Production**: In development, the app uses the `firebase-admin-sdk-credentials.json` file. In production, it needs the `FIREBASE_ADMIN_CREDENTIALS` environment variable.

2. **Storage Rules**: The template files require authentication to read:
   ```javascript
   match /schools/{schoolId}/template.jpg {
     allow read: if request.auth != null;
     allow write: if request.auth != null;
   }
   ```

3. **API Route Dependency**: The `/api/get-template` route uses Firebase Admin to access the storage bucket, which requires proper authentication.

## Solution

### Step 1: Generate the Environment Variable

Run the setup script to generate the correct environment variable:

```bash
npm run setup-admin
```

This will output something like:
```
FIREBASE_ADMIN_CREDENTIALS={"type":"service_account","project_id":"malik-studio-photo",...}
```

### Step 2: Set the Environment Variable in Production

#### For Vercel:
1. Go to your Vercel dashboard
2. Navigate to your project settings
3. Go to the "Environment Variables" section
4. Add a new variable:
   - **Name**: `FIREBASE_ADMIN_CREDENTIALS`
   - **Value**: Copy the entire JSON string from the setup script output
   - **Environment**: Production (and Preview if needed)

#### For Other Platforms:
Add the environment variable to your hosting platform's configuration.

### Step 3: Redeploy

After setting the environment variable, redeploy your application.

## Verification

### Test the API Endpoint

You can test if the fix worked by calling the test endpoint:

```bash
curl "https://your-domain.com/api/test-admin"
```

Expected response:
```json
{
  "success": true,
  "message": "Firebase Admin is working correctly",
  "bucket": "malik-studio-photo.firebasestorage.app",
  "filesInSchools": [...],
  "totalFiles": 10
}
```

### Test Template Fetch

You can also test the template fetch directly:

```bash
curl "https://your-domain.com/api/get-template?path=schools/school/template.jpg" -I
```

Expected response:
```
HTTP/1.1 200 OK
Content-Type: image/jpeg
```

## Prevention

### For Future Deployments

1. **Always run the setup script** before deploying:
   ```bash
   npm run setup-admin
   ```

2. **Verify environment variables** are set in your hosting platform

3. **Test the admin endpoint** after deployment

### Environment Variables Checklist

Make sure these environment variables are set in production:

- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY`
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_APP_ID`
- [ ] `BREVO_API_KEY`
- [ ] `SENDER_NOTIFICATION_EMAIL`
- [ ] `RECIEVER_NOTIFICATION_EMAIL`
- [ ] `FIREBASE_ADMIN_CREDENTIALS` ⭐ **CRITICAL**

## Troubleshooting

### If the error persists:

1. **Check the logs**: Look at your hosting platform's logs for Firebase Admin initialization errors
2. **Verify credentials**: Ensure the JSON in `FIREBASE_ADMIN_CREDENTIALS` is valid
3. **Test locally**: Try setting the environment variable locally to test
4. **Check storage rules**: Ensure the Firebase Admin service account has proper permissions

### Common Issues:

1. **Invalid JSON**: The credentials JSON must be properly formatted
2. **Missing quotes**: The entire JSON must be wrapped in quotes
3. **Wrong project**: Ensure the credentials are for the correct Firebase project
4. **Expired credentials**: Service account keys can expire - generate new ones if needed

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit** the `FIREBASE_ADMIN_CREDENTIALS` to version control
2. **Use environment variables** for all sensitive data
3. **Rotate credentials** periodically
4. **Limit permissions** of the service account to only what's needed

## Files Modified

- `src/app/api/get-template/route.ts` - Added better error logging
- `src/components/dashboard/single-upload-form.tsx` - Added detailed error reporting
- `src/lib/firebase-admin.ts` - Added initialization debugging
- `env.example` - Added Firebase Admin credentials documentation
- `deployment.txt` - Updated deployment instructions
- `scripts/setup-admin-credentials.js` - New setup script
- `package.json` - Added setup script command 