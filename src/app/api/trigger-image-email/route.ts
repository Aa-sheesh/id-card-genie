import { NextRequest, NextResponse } from 'next/server';
import { checkAndSendImages } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Only use schoolId if explicitly provided in the request body
    const schoolId = body.schoolId || undefined;
    console.log('🔄 API: Triggering image email check...', schoolId ? `for schoolId: ${schoolId}` : 'for all schools');
    await checkAndSendImages(schoolId);
    return NextResponse.json({
      success: true,
      message: `Image email check triggered${schoolId ? ' for schoolId: ' + schoolId : ' for all schools'}`
    });
  } catch (error) {
    console.error('❌ API: Error triggering image email check:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to trigger image email check',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 