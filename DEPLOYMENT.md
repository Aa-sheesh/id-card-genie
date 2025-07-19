# 🚀 ID Card Genie - Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Firebase Project**: Already configured
3. **GitHub Account**: For code repository

## Deployment Steps

### 1. Push Code to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit for deployment"

# Create a new repository on GitHub and push
git remote add origin https://github.com/yourusername/id-card-genie.git
git push -u origin main
```

### 2. Deploy to Vercel

1. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Environment Variables**:
   Add these environment variables in Vercel dashboard:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=malik-studio-photo
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=malik-studio-photo.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_password
   NOTIFICATION_EMAIL=recipient@example.com
   ```

3. **Upload Firebase Admin SDK Credentials**:
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add a new variable named `FIREBASE_ADMIN_CREDENTIALS`
   - Paste the entire content of your `firebase-admin-sdk-credentials.json` file

4. **Deploy**:
   - Click "Deploy"
   - Vercel will automatically build and deploy your app

### 3. Configure Custom Domain (Optional)

1. In Vercel dashboard, go to Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

## Post-Deployment Setup

### 1. Deploy Firebase Rules

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage
```

### 2. Test the Application

1. Visit your deployed URL
2. Test admin login
3. Test school creation
4. Test PDF generation
5. Test email notifications

### 3. Monitor Usage

- Set up Firebase billing alerts
- Monitor Vercel usage
- Check application logs

## Troubleshooting

### Common Issues

1. **Environment Variables**: Ensure all variables are set correctly
2. **Firebase Credentials**: Verify admin SDK credentials are uploaded
3. **CORS Issues**: Check Firebase configuration
4. **Build Errors**: Check Vercel build logs

### Support

- Check Vercel documentation: [vercel.com/docs](https://vercel.com/docs)
- Check Firebase documentation: [firebase.google.com/docs](https://firebase.google.com/docs)

## Cost Estimation

For 100 schools × 5,000 students = 500,000 students/year:

- **Vercel**: Free tier (Hobby plan)
- **Firebase**: ~₹500-1,500/month
- **Total**: ~₹500-1,500/month

## Security Notes

1. Never commit `.env` files to Git
2. Keep Firebase credentials secure
3. Use environment variables for all secrets
4. Regularly update dependencies 