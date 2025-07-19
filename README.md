# ID Card Genie 🪪

A modern, professional ID card generation and management system built with Next.js and Firebase. Streamline your ID card creation process with our intuitive interface and powerful bulk upload capabilities.

## ✨ Features

- **🔐 Secure Authentication** - Firebase Authentication with role-based access
- **🏫 School Management** - Create schools and assign login credentials
- **📋 Template Management** - Customize ID card templates with drag-and-drop interface
- **🖼️ PDF Generation** - High-quality PDF ID cards with custom layouts
- **📧 Automated Email Notifications** - Receive PDF summaries every 7 days via email
- **🏫 Multi-School Support** - Manage multiple schools and their templates
- **📱 Responsive Design** - Works seamlessly on desktop and mobile devices
- **⚡ Real-time Updates** - Live preview and instant feedback

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/id-card-genie.git
   cd id-card-genie
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your configuration:
   ```env
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   
   # Email Configuration for PDF Notifications
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_password
   NOTIFICATION_EMAIL=recipient@example.com
   ```

4. **Set up Firebase**
   - Create a Firebase project
   - Enable Authentication, Firestore, and Storage
   - Download your service account key and save as `firebase-admin-sdk-credentials.json`
   - Deploy security rules:
     ```bash
     firebase deploy --only firestore:rules,storage
     ```

5. **Set up Email Notifications**
   - For Gmail: Enable 2-Step Verification and generate an App Password
   - Go to Google Account → Security → App passwords
   - Generate a password for "Mail" and use it in `EMAIL_PASSWORD`
   - Set `NOTIFICATION_EMAIL` to the email where you want to receive PDF summaries

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
src/
├── app/                    # Next.js 13+ app directory
│   ├── admin/             # Admin dashboard pages
│   ├── dashboard/         # User dashboard pages
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── admin/            # Admin-specific components
│   ├── dashboard/        # Dashboard components
│   ├── ui/               # Reusable UI components
│   └── login-form.tsx    # Authentication components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and configurations
│   ├── actions.ts        # Server actions
│   ├── firebase.ts       # Firebase client config
│   ├── firebase-admin.ts # Firebase admin config
│   ├── types.ts          # TypeScript type definitions
│   └── utils.ts          # Utility functions
└── styles/               # Additional styles
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run typecheck` - Run TypeScript type checking
- `npm run clean` - Clean build artifacts
- `npm run analyze` - Analyze bundle size

## 🔧 Configuration

### Firebase Security Rules

The app includes optimized security rules for Firestore and Storage:

- **Firestore**: Authenticated users can read/write their school's data
- **Storage**: Authenticated users can upload/download files for their school

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key | ✅ |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | ✅ |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | ✅ |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | ✅ |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | ✅ |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | ✅ |
| `EMAIL_USER` | Email address for sending notifications | ✅ |
| `EMAIL_PASSWORD` | App password for email service | ✅ |
| `NOTIFICATION_EMAIL` | Email address to receive PDF summaries | ✅ |

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms

The app can be deployed to any platform that supports Next.js:

- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 📊 Performance

- **Lighthouse Score**: 95+ across all metrics
- **Bundle Size**: Optimized with tree shaking and code splitting
- **SEO**: Fully optimized with metadata, sitemap, and robots.txt
- **Security**: HTTPS headers and CSP policies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-username/id-card-genie/issues)
- **Email**: aa.sheesh@example.com

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Powered by [Firebase](https://firebase.google.com/)
- Icons by [Lucide React](https://lucide.dev/)

## License

This project is licensed under the [GNU General Public License v2.0](LICENSE).


---

Made with ❤️ by **Aa-sheesh**
