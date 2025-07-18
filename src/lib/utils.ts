import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { TemplateConfig, PreviewData } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function generateIDCardPDF(
  config: TemplateConfig,
  data: PreviewData,
  templateImageBuffer: ArrayBuffer,
  photoBuffer?: ArrayBuffer
): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Embed fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Embed the template image - try both PNG and JPEG
  let templateImage;
  try {
    templateImage = await pdfDoc.embedPng(templateImageBuffer);
  } catch {
    try {
      templateImage = await pdfDoc.embedJpg(templateImageBuffer);
    } catch (error) {
      throw new Error(`Failed to embed template image: ${error}`);
    }
  }
  
  // Create a page with the same dimensions as the template (856x540 as used in preview)
  const pageWidth = 856;
  const pageHeight = 540;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  
  // Draw the template image as background, scaled to match preview dimensions
  page.drawImage(templateImage, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
  });
  
  // If there's a photo, embed and place it exactly like in the preview
  if (photoBuffer) {
    try {
      // Try to embed the photo directly first
      let photoImage;
      try {
        photoImage = await pdfDoc.embedPng(photoBuffer);
      } catch {
        // If PNG embedding fails, try JPEG
        photoImage = await pdfDoc.embedJpg(photoBuffer);
      }
      
      // Use the exact same positioning as the live preview
      const photoX = config.photoPlacement.x;
      const photoY = pageHeight - config.photoPlacement.y - config.photoPlacement.height;
      
      page.drawImage(photoImage, {
        x: photoX,
        y: photoY,
        width: config.photoPlacement.width,
        height: config.photoPlacement.height,
      });
    } catch (error) {
      console.warn('Failed to embed photo in PDF:', error);
    }
  }
  
  // Add text fields with exact same positioning and styling as live preview
  config.textFields.forEach(field => {
    const text = data[field.id]?.toString() || '';
    if (text) {
      // Use the exact same positioning calculation as the live preview
      // Live preview uses: left: (field.x / 856) * 100% and top: (field.y / 540) * 100%
      // Convert back to absolute coordinates for PDF
      const textX = field.x;
      
      // Fix Y positioning: PDF positions at baseline, live preview positions at top
      // Need to adjust Y to account for font size so text appears at same visual position
      const textY = pageHeight - field.y - field.fontSize;
      
      page.drawText(text, {
        x: textX,
        y: textY,
        font: field.fontWeight === 'bold' ? boldFont : font,
        size: field.fontSize,
        color: rgb(0, 0, 0), // Same as live preview: #000000
      });
    }
  });
  
  // Save the PDF
  return await pdfDoc.save();
}
