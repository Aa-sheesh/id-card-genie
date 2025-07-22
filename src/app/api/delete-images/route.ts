import { NextRequest, NextResponse } from 'next/server';
import { deleteAllImages } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const schoolId = body.schoolId;
    const result = await deleteAllImages(schoolId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 