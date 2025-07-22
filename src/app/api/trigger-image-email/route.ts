import { NextRequest, NextResponse } from 'next/server';
import { triggerImageEmailCheck } from '@/lib/cron-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const schoolId = body.schoolId;
    console.log('🔄 API: Triggering image email check...', schoolId ? `for schoolId: ${schoolId}` : 'for all schools');
    // Option 1: Await (synchronous, blocks UI)
    // await triggerImageEmailCheck(schoolId);
    // Option 2: setTimeout (non-blocking, but not a real queue)
    setTimeout(() => {
      triggerImageEmailCheck(schoolId).catch((err) => {
        console.error('❌ Error in background image email check:', err);
      });
    }, 0);
    return NextResponse.json({
      success: true,
      message: `Image email check triggered${schoolId ? ' for schoolId: ' + schoolId : ''}`
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