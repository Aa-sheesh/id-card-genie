#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Firebase Admin Credentials Setup Helper');
console.log('==========================================\n');

// Check if credentials file exists
const credentialsPath = path.join(process.cwd(), 'firebase-admin-sdk-credentials.json');

if (!fs.existsSync(credentialsPath)) {
  console.error('❌ firebase-admin-sdk-credentials.json not found in project root!');
  console.log('\n📋 Please:');
  console.log('1. Download the Firebase Admin SDK service account key from Firebase Console');
  console.log('2. Save it as "firebase-admin-sdk-credentials.json" in the project root');
  console.log('3. Run this script again');
  process.exit(1);
}

try {
  // Read and parse the credentials file
  const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
  const credentials = JSON.parse(credentialsContent);
  
  // Validate the credentials structure
  if (!credentials.type || !credentials.project_id || !credentials.private_key_id) {
    console.error('❌ Invalid Firebase Admin credentials format!');
    console.log('The file should contain a valid service account JSON object.');
    process.exit(1);
  }
  
  console.log('✅ Firebase Admin credentials file found and validated');
  console.log(`📋 Project ID: ${credentials.project_id}`);
  console.log(`🔑 Private Key ID: ${credentials.private_key_id}`);
  
  // Convert to single line JSON for environment variable
  const singleLineCredentials = JSON.stringify(credentials);
  
  console.log('\n📝 For production deployment, set this environment variable:');
  console.log('============================================================');
  console.log('FIREBASE_ADMIN_CREDENTIALS=' + singleLineCredentials);
  console.log('============================================================\n');
  
  console.log('📋 Instructions:');
  console.log('1. Copy the entire line above (starting with FIREBASE_ADMIN_CREDENTIALS=)');
  console.log('2. Add it to your production environment variables (Vercel, etc.)');
  console.log('3. Make sure to include the entire JSON content, including quotes');
  console.log('\n⚠️  Important: Never commit this value to version control!');
  
  // Also create a .env.local template
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envLocalPath)) {
    const envContent = `# Firebase Admin SDK (for local development)
FIREBASE_ADMIN_CREDENTIALS=${singleLineCredentials}

# Add other environment variables here
`;
    fs.writeFileSync(envLocalPath, envContent);
    console.log('\n✅ Created .env.local template with Firebase Admin credentials');
    console.log('⚠️  Remember to add .env.local to your .gitignore file!');
  } else {
    console.log('\n📝 .env.local already exists - manually add the FIREBASE_ADMIN_CREDENTIALS line');
  }
  
} catch (error) {
  console.error('❌ Error processing credentials file:', error.message);
  process.exit(1);
} 