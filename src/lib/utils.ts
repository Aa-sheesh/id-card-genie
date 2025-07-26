import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { TemplateConfig, PreviewData, TemplatePreset, TEMPLATE_PRESETS } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility function to get image dimensions
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

// Calculate default field positions based on template dimensions
export function calculateDefaultPositions(width: number, height: number) {
  const photoPlacement = {
    x: Math.round(width * 0.08), // 8% from left - positioned where the dashed blue rectangle is
    y: Math.round(height * 0.25), // 25% from top
    width: Math.round(width * 0.20), // 20% of width - slightly smaller for better fit
    height: Math.round(height * 0.30), // 30% of height
  };

  const textFields = [
    {
      id: "name",
      name: "Full Name",
      x: Math.round(width * 0.32), // 32% from left - positioned to the right of photo
      y: Math.round(height * 0.30), // 30% from top
      fontSize: Math.round(Math.max(18, width * 0.021)), // Slightly larger font for name
      fontWeight: "bold" as const,
      color: "#000000",
      fontFamily: "Arial, sans-serif",
      textAlign: "left" as const,
    },
    {
      id: "rollNo",
      name: "Roll No",
      x: Math.round(width * 0.32), // 32% from left
      y: Math.round(height * 0.40), // 40% from top
      fontSize: Math.round(Math.max(14, width * 0.018)), // Medium font
      fontWeight: "normal" as const,
      color: "#333333",
      fontFamily: "Arial, sans-serif",
      textAlign: "left" as const,
    },
    {
      id: "class",
      name: "Class",
      x: Math.round(width * 0.32), // 32% from left
      y: Math.round(height * 0.50), // 50% from top
      fontSize: Math.round(Math.max(14, width * 0.018)), // Medium font
      fontWeight: "normal" as const,
      color: "#333333",
      fontFamily: "Arial, sans-serif",
      textAlign: "left" as const,
    },
    {
      id: "contact",
      name: "Contact",
      x: Math.round(width * 0.32), // 32% from left
      y: Math.round(height * 0.60), // 60% from top
      fontSize: Math.round(Math.max(14, width * 0.018)), // Medium font
      fontWeight: "normal" as const,
      color: "#333333",
      fontFamily: "Arial, sans-serif",
      textAlign: "left" as const,
    },
    {
      id: "address",
      name: "Address",
      x: Math.round(width * 0.32), // 32% from left
      y: Math.round(height * 0.70), // 70% from top
      fontSize: Math.round(Math.max(12, width * 0.016)), // Smaller font for address
      fontWeight: "normal" as const,
      color: "#333333",
      fontFamily: "Arial, sans-serif",
      textAlign: "left" as const,
    },
  ];

  return { photoPlacement, textFields };
}

// Convert coordinates from one dimension to another (for responsive scaling)
export function convertCoordinates(
  coordinates: { x: number; y: number; width?: number; height?: number },
  fromDimensions: { width: number; height: number },
  toDimensions: { width: number; height: number }
) {
  const scaleX = toDimensions.width / fromDimensions.width;
  const scaleY = toDimensions.height / fromDimensions.height;

  return {
    x: Math.round(coordinates.x * scaleX),
    y: Math.round(coordinates.y * scaleY),
    ...(coordinates.width && { width: Math.round(coordinates.width * scaleX) }),
    ...(coordinates.height && { height: Math.round(coordinates.height * scaleY) }),
  };
}

// Verify coordinate calculations match between admin and school
export function verifyCoordinateCalculations(
  config: TemplateConfig,
  context: 'admin' | 'school'
) {
  const { templateDimensions, photoPlacement, textFields } = config;
  const { width, height } = templateDimensions;
  
  const photoPercentages = {
    left: (photoPlacement.x / width) * 100,
    top: (photoPlacement.y / height) * 100,
    width: (photoPlacement.width / width) * 100,
    height: (photoPlacement.height / height) * 100,
  };
  
  const textPercentages = textFields.map(field => ({
    id: field.id,
    left: (field.x / width) * 100,
    top: (field.y / height) * 100,
  }));
  
  console.log(`🎯 ${context.toUpperCase()} - Coordinate verification:`, {
    dimensions: { width, height },
    photoPercentages,
    textPercentages,
  });
  
  return { photoPercentages, textPercentages };
}

// Calculate field positions consistently across all components
export function calculateFieldPositions(
  config: TemplateConfig,
  context: 'preview' | 'pdf'
) {
  const { templateDimensions, photoPlacement, textFields } = config;
  const { width, height } = templateDimensions;
  
  const photoPositions = {
    left: (photoPlacement.x / width) * 100,
    top: (photoPlacement.y / height) * 100,
    width: (photoPlacement.width / width) * 100,
    height: (photoPlacement.height / height) * 100,
    // For PDF, we need absolute coordinates with Y flipped (PDF starts from bottom)
    absoluteX: photoPlacement.x,
    absoluteY: context === 'pdf' ? height - photoPlacement.y - photoPlacement.height : photoPlacement.y,
    absoluteWidth: photoPlacement.width,
    absoluteHeight: photoPlacement.height,
  };
  
  const textPositions = textFields.map(field => ({
    id: field.id,
    name: field.name,
    left: (field.x / width) * 100,
    top: (field.y / height) * 100,
    // For PDF, we need absolute coordinates with Y flipped and adjusted for font baseline
    absoluteX: field.x,
    absoluteY: context === 'pdf' ? height - field.y - field.fontSize : field.y,
    fontSize: field.fontSize,
    fontWeight: field.fontWeight,
  }));
  
  console.log(`🎯 ${context.toUpperCase()} - Field positions calculated:`, {
    dimensions: { width, height },
    photoPositions: {
      ...photoPositions,
      originalY: photoPlacement.y,
      pdfY: context === 'pdf' ? height - photoPlacement.y - photoPlacement.height : photoPlacement.y
    },
    textPositions: textPositions.map(t => ({ 
      id: t.id, 
      left: t.left.toFixed(1), 
      top: t.top.toFixed(1),
      originalY: textFields.find(f => f.id === t.id)?.y,
      pdfY: context === 'pdf' ? height - (textFields.find(f => f.id === t.id)?.y || 0) - (textFields.find(f => f.id === t.id)?.fontSize || 0) : textFields.find(f => f.id === t.id)?.y
    })),
  });
  
  return { photoPositions, textPositions };
}

// Test function to verify coordinate calculations
export function testCoordinateCalculations() {
  const testConfig: TemplateConfig = {
    templateImagePath: 'test',
    templateDimensions: { width: 856, height: 540 },
    photoPlacement: { x: 40, y: 135, width: 150, height: 162 },
    textFields: [
      { id: "name", name: "Full Name", x: 220, y: 162, fontSize: 20, fontWeight: "bold", color: "#000000", fontFamily: "Arial, sans-serif" },
      { id: "rollNo", name: "Roll No", x: 220, y: 216, fontSize: 16, fontWeight: "normal", color: "#333333", fontFamily: "Arial, sans-serif" },
      { id: "class", name: "Class", x: 220, y: 270, fontSize: 16, fontWeight: "normal", color: "#333333", fontFamily: "Arial, sans-serif" },
      { id: "contact", name: "Contact", x: 220, y: 324, fontSize: 16, fontWeight: "normal", color: "#333333", fontFamily: "Arial, sans-serif" },
      { id: "address", name: "Address", x: 220, y: 378, fontSize: 14, fontWeight: "normal", color: "#333333", fontFamily: "Arial, sans-serif" }
    ],
  };

  console.log("🧪 Testing coordinate calculations...");
  
  const previewPositions = calculateFieldPositions(testConfig, 'preview');
  const pdfPositions = calculateFieldPositions(testConfig, 'pdf');
  
  console.log("📊 Preview positions:", previewPositions);
  console.log("📊 PDF positions:", pdfPositions);
  
  // Verify that X coordinates are the same for both preview and PDF
  const xConsistent = previewPositions.textPositions.every((preview, i) => 
    preview.absoluteX === pdfPositions.textPositions[i].absoluteX
  );
  
  console.log("✅ X coordinates consistent:", xConsistent);
  
  return { previewPositions, pdfPositions, xConsistent };
}

// Helper function to manually adjust coordinates for specific templates
export function adjustCoordinatesForTemplate(
  config: TemplateConfig,
  adjustments: {
    photo?: { x?: number; y?: number; width?: number; height?: number };
    textFields?: Record<string, { x?: number; y?: number; fontSize?: number }>;
  }
): TemplateConfig {
  const adjustedConfig = { ...config };
  
  // Adjust photo placement
  if (adjustments.photo) {
    adjustedConfig.photoPlacement = {
      ...adjustedConfig.photoPlacement,
      ...adjustments.photo
    };
  }
  
  // Adjust text fields
  if (adjustments.textFields) {
    adjustedConfig.textFields = adjustedConfig.textFields.map(field => ({
      ...field,
      ...adjustments.textFields?.[field.id]
    }));
  }
  
  console.log("🔧 Adjusted coordinates:", {
    original: { photo: config.photoPlacement, textFields: config.textFields },
    adjusted: { photo: adjustedConfig.photoPlacement, textFields: adjustedConfig.textFields }
  });
  
  return adjustedConfig;
}

export async function generateIDCardPDF(
  config: TemplateConfig,
  data: PreviewData,
  templateImageBuffer: ArrayBuffer,
  photoBuffer?: ArrayBuffer
): Promise<Uint8Array> {
  // Test coordinate calculations for debugging
  testCoordinateCalculations();
  
  console.log("🎯 PDF Generation - Starting with config:", {
    templateDimensions: config.templateDimensions,
    photoPlacement: config.photoPlacement,
    textFields: config.textFields,
    data: Object.keys(data).reduce((acc, key) => {
      if (typeof data[key] === 'string') {
        acc[key] = data[key];
      }
      return acc;
    }, {} as Record<string, string>)
  });
  
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
  
  // Use the actual template dimensions from config
  const pageWidth = config.templateDimensions.width;
  const pageHeight = config.templateDimensions.height;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  
  // Draw the template image as background, scaled to match actual dimensions
  page.drawImage(templateImage, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
  });
  
  // Calculate positions using the same logic as the preview
  const { photoPositions, textPositions } = calculateFieldPositions(config, 'pdf');
  
  // If there's a photo, embed and place it
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
      
      // Use the calculated positions from the same function as preview
      page.drawImage(photoImage, {
        x: photoPositions.absoluteX,
        y: photoPositions.absoluteY,
        width: photoPositions.absoluteWidth,
        height: photoPositions.absoluteHeight,
      });
      
      console.log("📸 PDF Photo placement:", {
        originalCoords: { x: config.photoPlacement.x, y: config.photoPlacement.y, width: config.photoPlacement.width, height: config.photoPlacement.height },
        pdfCoords: { x: photoPositions.absoluteX, y: photoPositions.absoluteY, width: photoPositions.absoluteWidth, height: photoPositions.absoluteHeight }
      });
    } catch (error) {
      console.warn('Failed to embed photo in PDF:', error);
    }
  }
  
  // Add text fields using the same positioning logic as preview
  textPositions.forEach(field => {
    const text = data[field.id]?.toString() || '';
    if (text) {
      // Find the corresponding text field config to get color and font family
      const textFieldConfig = config.textFields.find(f => f.id === field.id);
      
      // Convert hex color to RGB for PDF
      const hexColor = textFieldConfig?.color || '#000000';
      const r = parseInt(hexColor.slice(1, 3), 16) / 255;
      const g = parseInt(hexColor.slice(3, 5), 16) / 255;
      const b = parseInt(hexColor.slice(5, 7), 16) / 255;
      
      // Use appropriate font based on weight (PDF.js has limited font support)
      const pdfFont = field.fontWeight === 'bold' ? boldFont : font;
      
      page.drawText(text, {
        x: field.absoluteX,
        y: field.absoluteY,
        font: pdfFont,
        size: field.fontSize,
        color: rgb(r, g, b),
      });
      
      console.log("📝 PDF Text placement:", {
        id: field.id,
        text: text.substring(0, 20) + (text.length > 20 ? '...' : ''),
        originalCoords: { x: config.textFields.find(f => f.id === field.id)?.x, y: config.textFields.find(f => f.id === field.id)?.y },
        pdfCoords: { x: field.absoluteX, y: field.absoluteY },
        fontSize: field.fontSize,
        fontWeight: field.fontWeight,
        color: textFieldConfig?.color,
        fontFamily: textFieldConfig?.fontFamily
      });
    }
  });
  
  // Save the PDF
  return await pdfDoc.save();
}

// Generate superimposed JPG image directly using Canvas
export async function generateIDCardJPG(
  config: TemplateConfig,
  data: PreviewData,
  templateImageBuffer: ArrayBuffer,
  photoBuffer?: ArrayBuffer
): Promise<Blob> {
  console.log("🎯 JPG Generation - Starting with config:", {
    templateDimensions: config.templateDimensions,
    photoPlacement: config.photoPlacement,
    textFields: config.textFields,
    data: Object.keys(data).reduce((acc, key) => {
      if (typeof data[key] === 'string') {
        acc[key] = data[key];
      }
      return acc;
    }, {} as Record<string, string>)
  });

  // First, verify template dimensions
  const dimensionCheck = await verifyTemplateDimensions(config, templateImageBuffer);
  
  // Use actual image dimensions if they don't match config
  const finalDimensions = dimensionCheck.match ? config.templateDimensions : dimensionCheck.actualDimensions;
  
  console.log("📐 Using dimensions for JPG generation:", finalDimensions);

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Set canvas dimensions to match template EXACTLY
    const { width, height } = finalDimensions;
    canvas.width = width;
    canvas.height = height;
    
    console.log("📐 Canvas dimensions set to:", { width, height });

    // Create image objects
    const templateImg = new Image();
    const photoImg = photoBuffer ? new Image() : null;

    // Load template image
    templateImg.onload = () => {
      console.log("🖼️ Template image loaded with dimensions:", { 
        naturalWidth: templateImg.naturalWidth, 
        naturalHeight: templateImg.naturalHeight 
      });
      
      // Draw template as background at EXACT dimensions
      ctx.drawImage(templateImg, 0, 0, width, height);
      console.log("✅ Template drawn to canvas at:", { width, height });

      // If there's a photo, load and draw it
      if (photoImg && photoBuffer) {
        photoImg.onload = () => {
          console.log("📸 Photo image loaded with dimensions:", { 
            naturalWidth: photoImg.naturalWidth, 
            naturalHeight: photoImg.naturalHeight 
          });
          
          // Use the exact same positioning logic as the preview
          const { photoPositions } = calculateFieldPositions(config, 'preview');
          
          // Convert percentages to absolute pixels (same as preview)
          const photoX = (photoPositions.left / 100) * width;
          const photoY = (photoPositions.top / 100) * height;
          const photoWidth = (photoPositions.width / 100) * width;
          const photoHeight = (photoPositions.height / 100) * height;

          console.log("📸 JPG Photo placement:", {
            percentages: photoPositions,
            pixels: { x: photoX, y: photoY, width: photoWidth, height: photoHeight },
            canvasDimensions: { width, height }
          });

          // Draw photo with exact positioning
          ctx.drawImage(photoImg, photoX, photoY, photoWidth, photoHeight);

          // Add text fields with exact same positioning as preview
          addTextFieldsToCanvas(ctx, config, data, width, height);

          // Convert to JPG blob with exact dimensions
          canvas.toBlob((blob) => {
            if (blob) {
              console.log("✅ JPG generated successfully with dimensions:", { width, height });
              resolve(blob);
            } else {
              reject(new Error('Failed to generate JPG blob'));
            }
          }, 'image/jpeg', 0.95); // High quality JPG
        };

        photoImg.onerror = () => {
          console.warn('Failed to load photo, continuing without it');
          // Add text fields without photo
          addTextFieldsToCanvas(ctx, config, data, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              console.log("✅ JPG generated successfully (without photo) with dimensions:", { width, height });
              resolve(blob);
            } else {
              reject(new Error('Failed to generate JPG blob'));
            }
          }, 'image/jpeg', 0.95);
        };

        // Load photo from buffer
        const photoBlob = new Blob([photoBuffer]);
        photoImg.src = URL.createObjectURL(photoBlob);
      } else {
        // No photo, just add text fields
        addTextFieldsToCanvas(ctx, config, data, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            console.log("✅ JPG generated successfully (without photo) with dimensions:", { width, height });
            resolve(blob);
          } else {
            reject(new Error('Failed to generate JPG blob'));
          }
        }, 'image/jpeg', 0.95);
      }
    };

    templateImg.onerror = () => {
      reject(new Error('Failed to load template image'));
    };

    // Load template from buffer
    const templateBlob = new Blob([templateImageBuffer]);
    templateImg.src = URL.createObjectURL(templateBlob);
  });
}

// Helper function to add text fields to canvas - EXACTLY like the preview
function addTextFieldsToCanvas(
  ctx: CanvasRenderingContext2D,
  config: TemplateConfig,
  data: PreviewData,
  width: number,
  height: number
) {
  // Use the exact same positioning logic as the preview
  const { textPositions } = calculateFieldPositions(config, 'preview');
  
  textPositions.forEach(field => {
    const text = data[field.id]?.toString() || '';
    if (text) {
      // Find the corresponding text field config to get color and font family
      const textFieldConfig = config.textFields.find(f => f.id === field.id);
      
      // Set font style with custom font family and weight
      const fontFamily = textFieldConfig?.fontFamily || 'Arial, sans-serif';
      const fontWeight = field.fontWeight === 'bold' ? 'bold' : 'normal';
      ctx.font = `${fontWeight} ${field.fontSize}px ${fontFamily}`;
      
      // Set text color from config
      ctx.fillStyle = textFieldConfig?.color || '#000000';
      ctx.textBaseline = 'top'; // Same baseline as preview
      
      // Calculate position using percentages (same as preview)
      const x = (field.left / 100) * width;
      const y = (field.top / 100) * height;
      
      // Draw text with exact positioning
      ctx.fillText(text, x, y);
      
      console.log("📝 JPG Text placement:", {
        id: field.id,
        text: text.substring(0, 20) + (text.length > 20 ? '...' : ''),
        percentages: { left: field.left, top: field.top },
        pixels: { x, y },
        fontSize: field.fontSize,
        fontWeight: field.fontWeight,
        color: textFieldConfig?.color,
        fontFamily: textFieldConfig?.fontFamily
      });
    }
  });
}

// Verify template dimensions match between config and actual image
export async function verifyTemplateDimensions(
  config: TemplateConfig,
  templateImageBuffer: ArrayBuffer
): Promise<{ match: boolean; configDimensions: { width: number; height: number }; actualDimensions: { width: number; height: number } }> {
  return new Promise((resolve) => {
    const configDimensions = config.templateDimensions;
    
    const img = new Image();
    img.onload = () => {
      const actualDimensions = {
        width: img.naturalWidth,
        height: img.naturalHeight
      };
      
      const match = configDimensions.width === actualDimensions.width && 
                   configDimensions.height === actualDimensions.height;
      
      console.log("🔍 Template dimension verification:", {
        configDimensions,
        actualDimensions,
        match
      });
      
      resolve({ match, configDimensions, actualDimensions });
    };
    
    img.onerror = () => {
      console.warn("Could not verify template dimensions - image failed to load");
      resolve({ 
        match: false, 
        configDimensions, 
        actualDimensions: { width: 0, height: 0 } 
      });
    };
    
    const blob = new Blob([templateImageBuffer]);
    img.src = URL.createObjectURL(blob);
  });
}
