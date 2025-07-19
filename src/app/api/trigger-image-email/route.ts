import { NextRequest, NextResponse } from 'next/server';
import { triggerImageEmailCheck } from '@/lib/cron-service';

export async function POST(_request: NextRequest) {
  try {
    console.log('🔄 API: Triggering image email check...');
    
    await triggerImageEmailCheck();
    
    console.log('✅ API: Image email check completed successfully');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Image email check triggered successfully' 
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