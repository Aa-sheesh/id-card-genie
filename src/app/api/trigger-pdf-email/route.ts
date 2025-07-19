import { NextRequest, NextResponse } from 'next/server';
import { triggerPDFEmailCheck } from '@/lib/cron-service';

export async function POST(request: NextRequest) {
  try {
    // Check if it's an admin request (you can add authentication here)
    const authHeader = request.headers.get('authorization');
    
    // Check if it's an admin request (you can add authentication here)
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }
    
    console.log('Manual PDF email check triggered via API');
    await triggerPDFEmailCheck();
    
    return NextResponse.json({
      success: true,
      message: 'PDF email check completed successfully'
    });
    
  } catch (error) {
    console.error('Error in manual PDF email trigger:', error);
    return NextResponse.json(
      { error: 'Failed to trigger PDF email check' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to trigger PDF email check',
    endpoint: '/api/trigger-pdf-email'
  });
} 