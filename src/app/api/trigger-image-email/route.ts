import { NextRequest, NextResponse } from 'next/server';
import { checkAndSendImages } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Only use schoolId if explicitly provided in the request body
    const schoolId = body.schoolId || undefined;
    console.log('🔄 API: Triggering Excel & ZIP generation...', schoolId ? `for schoolId: ${schoolId}` : 'for all schools');
    
    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), 50000); // 50 second timeout
    });
    
    const operationPromise = checkAndSendImages(schoolId);
    
    await Promise.race([operationPromise, timeoutPromise]);
    
    return NextResponse.json({
      success: true,
      message: `Excel & ZIP generation triggered${schoolId ? ' for schoolId: ' + schoolId : ' for all schools'}`
    });
  } catch (error) {
    console.error('❌ API: Error triggering Excel & ZIP generation:', error);
    
    // Check if it's a timeout error
    if (error instanceof Error && error.message.includes('timed out')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Operation timed out - too many files to process. Try processing individual schools instead.',
          details: 'The ZIP generation took too long. Consider processing schools individually or reducing the number of images.'
        },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to trigger Excel & ZIP generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 