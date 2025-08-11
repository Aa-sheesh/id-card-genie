import { NextRequest, NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const templatePath = searchParams.get('path');

  if (!templatePath) {
    return NextResponse.json(
      { error: 'Template path is required' },
      { status: 400 }
    );
  }

  try {

    const adminServices = getAdminServices();
    if (!adminServices) {
      console.error('❌ Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const { storage } = adminServices;
    console.log('🔧 Using storage bucket: malik-studio-photo.firebasestorage.app');
    const bucket = storage.bucket('malik-studio-photo.firebasestorage.app');
    const file = bucket.file(templatePath);
    console.log('📁 Looking for file at path:', templatePath);

    // Check if file exists
    console.log('🔍 Checking if file exists...');
    const [exists] = await file.exists();
    console.log('📋 File exists:', exists);
    if (!exists) {
      console.error('❌ Template file not found at path:', templatePath);
      return NextResponse.json(
        { error: 'Template file not found' },
        { status: 404 }
      );
    }

    // Get file content
    const [fileContent] = await file.download();
    
    // Get content type
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'image/jpeg';

    // Return the file with proper headers
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Error fetching template:', error);
    console.error('Error details:', {
      templatePath: templatePath || 'undefined',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      environment: process.env.NODE_ENV,
      hasAdminServices: !!getAdminServices(),
    });
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 