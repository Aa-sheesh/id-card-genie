import { NextRequest, NextResponse } from 'next/server';
import { generateSchoolImagesExcel } from '@/lib/email-service';
import { getAdminServices } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await request.json();
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'schoolId is required' }, { status: 400 });
    }
    
    console.log(`[UPDATE-EXCEL] Starting Excel update for school: ${schoolId}`);
    
    // Add a small delay to ensure the image upload is fully completed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const excelBuffer = await generateSchoolImagesExcel(schoolId);
    const { storage } = getAdminServices();
    const bucket = storage.bucket('malik-studio-photo.firebasestorage.app');
    const file = bucket.file(`schools/${schoolId}/images/images-list.xlsx`);
    await file.save(excelBuffer, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    console.log(`[UPDATE-EXCEL] Excel file updated successfully for school: ${schoolId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[UPDATE-EXCEL] Error updating Excel for school:`, error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 