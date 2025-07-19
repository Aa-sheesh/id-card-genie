import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/hooks/use-auth';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: {
    default: 'ID Card Genie - Professional ID Card Management System',
    template: '%s | ID Card Genie'
  },
  description: 'Streamline your ID card generation process with our professional management system. Create, customize, and manage student and employee ID cards efficiently.',
  keywords: ['ID card generator', 'student ID cards', 'employee ID cards', 'ID card management', 'school ID cards', 'professional ID cards'],
  authors: [{ name: 'Aa-sheesh' }],
  creator: 'Aa-sheesh',
  publisher: 'Aa-sheesh',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://id-card-genie.vercel.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://id-card-genie.vercel.app',
    title: 'ID Card Genie - Professional ID Card Management System',
    description: 'Streamline your ID card generation process with our professional management system.',
    siteName: 'ID Card Genie',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ID Card Genie - Professional ID Card Management System',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ID Card Genie - Professional ID Card Management System',
    description: 'Streamline your ID card generation process with our professional management system.',
    images: ['/og-image.png'],
    creator: '@aa_sheesh',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.ico', type: 'image/x-icon' }
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
