# **App Name**: ID Card Genie

## Core Features:

- User Authentication: User authentication via Firebase Authentication with hardcoded email/password credentials.
- Template Configuration: Admin uploads ID card template image and defines field positions, stored in Firestore.
- Data Upload: Users upload ID card data and photos via single form or bulk upload (Excel, ZIP).
- PDF Generation & Emailing: Cloud Function generates PDFs, compresses images, emails PDF, and deletes uploaded files.
- Submission Logic: Conditional PDF generation logic based on upload type/volume; scheduled sending for low-volume uploads. A tool determines the conditions.

## Style Guidelines:

- Primary color: Dark cyan (#4A777A) to reflect security, structure, and trust. 
- Background color: Light cyan (#E0E5E5), very lightly tinted, to give a sense of spaciousness. 
- Accent color: Dusty purple (#7A4A77) as a complementary color for less critical but interactive elements like buttons or toggles.
- Font pairing: 'Poppins' (sans-serif) for headlines and short amounts of text; 'PT Sans' (sans-serif) for body text.
- Clean and organized layout, prioritizing template preview and upload sections. Clear instructions for data upload and progress indicators.
- Simple, clear icons to represent data fields, upload options, and email status.