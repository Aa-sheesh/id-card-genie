"use client";

import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { ImageIcon, Loader2, User } from 'lucide-react';
import type { TemplateConfig, PreviewData } from '@/lib/types';
import { storage } from '@/lib/firebase';
import { getDownloadURL, ref } from 'firebase/storage';
import { verifyCoordinateCalculations, calculateFieldPositions } from '@/lib/utils';


interface TemplatePreviewProps {
  config: TemplateConfig | null;
  previewData?: PreviewData | null;
}

export function TemplatePreview({ config, previewData }: TemplatePreviewProps) {
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
    const [templateUrl, setTemplateUrl] = useState<string | null>(null);
    const [isLoadingUrl, setIsLoadingUrl] = useState(true);

    useEffect(() => {
        let objectUrl: string | null = null;
        if (previewData?.photo && previewData.photo instanceof File) {
            objectUrl = URL.createObjectURL(previewData.photo);
            setPhotoPreviewUrl(objectUrl);
        } else {
            setPhotoPreviewUrl(null);
        }
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [previewData?.photo]);

    useEffect(() => {
        const fetchTemplateUrl = async () => {
            if (config?.templateImagePath && storage) {
                setIsLoadingUrl(true);
                try {
                    const storageRef = ref(storage, config.templateImagePath);
                    const url = await getDownloadURL(storageRef);
                    setTemplateUrl(url);
                } catch (error) {
                    console.error("Failed to get template URL for preview:", error);
                    setTemplateUrl(null);
                } finally {
                    setIsLoadingUrl(false);
                }
            } else {
                setTemplateUrl(null);
                setIsLoadingUrl(false);
            }
        };

        fetchTemplateUrl();
    }, [config?.templateImagePath]);

    // Enhanced debug logging for coordinate calculations
    useEffect(() => {
        if (config) {
            const templateWidth = config.templateDimensions?.width || 856;
            const templateHeight = config.templateDimensions?.height || 540;
            
            console.log("🎯 SCHOOL DASHBOARD - Template preview using config:", {
                photoPlacement: config.photoPlacement,
                textFields: config.textFields,
                templateImagePath: config.templateImagePath,
                templateDimensions: config.templateDimensions,
                calculatedPercentages: {
                    photo: {
                        left: `${(config.photoPlacement.x / templateWidth) * 100}%`,
                        top: `${(config.photoPlacement.y / templateHeight) * 100}%`,
                        width: `${(config.photoPlacement.width / templateWidth) * 100}%`,
                        height: `${(config.photoPlacement.height / templateHeight) * 100}%`,
                    },
                    textFields: config.textFields.map(field => ({
                        id: field.id,
                        left: `${(field.x / templateWidth) * 100}%`,
                        top: `${(field.y / templateHeight) * 100}%`,
                        fontSize: field.fontSize,
                        fontWeight: field.fontWeight
                    }))
                }
            });
            
            // Verify coordinate calculations
            verifyCoordinateCalculations(config, 'school');
        }
    }, [config]);


  if (isLoadingUrl) {
    return (
        <Card className="flex aspect-[85.6/54] w-full items-center justify-center border-dashed bg-muted/50">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </Card>
    );
  }

  if (!config?.templateImagePath || !templateUrl) {
    return (
      <Card className="flex aspect-[85.6/54] w-full items-center justify-center border-dashed bg-muted/50">
        <div className="text-center text-muted-foreground">
          <ImageIcon className="mx-auto h-12 w-12" />
          <p className="mt-2 font-semibold">No template configured.</p>
          <p className="text-xs">The assigned template will be shown here.</p>
        </div>
      </Card>
    );
  }
  
  const hasData = previewData && Object.values(previewData).some(v => v);
  const templateWidth = config.templateDimensions?.width || 856;
  const templateHeight = config.templateDimensions?.height || 540;

  // Calculate all positions consistently
  const { photoPositions, textPositions } = calculateFieldPositions(config, 'preview');

  return (
    <div className="relative w-full overflow-hidden rounded-lg border">
        <div 
          className="relative w-full"
          style={{
            aspectRatio: `${templateWidth}/${templateHeight}`,
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        >
          <Image
              src={templateUrl}
              alt="ID Card Template"
              width={templateWidth}
              height={templateHeight}
              className="w-full h-full object-contain"
              style={{
                aspectRatio: `${templateWidth}/${templateHeight}`
              }}
              data-ai-hint="id card template"
              priority
          />
          
          {config.photoPlacement && (
               <div
                  className="absolute flex items-center justify-center"
                  style={{
                      left: `${photoPositions.left}%`,
                      top: `${photoPositions.top}%`,
                      width: `${photoPositions.width}%`,
                      height: `${photoPositions.height}%`,
                  }}
              >
                  {photoPreviewUrl ? (
                      <Image src={photoPreviewUrl} alt="User photo preview" layout="fill" objectFit="cover" className="bg-muted" />
                  ) : (
                      <div className="w-full h-full bg-muted/70 flex items-center justify-center text-muted-foreground border-2 border-dashed border-blue-400">
                          {hasData ? <User className="w-1/2 h-1/2 opacity-50" /> : <span className="p-1 text-xs text-blue-800 bg-white/50 rounded-sm">Photo</span>}
                      </div>
                  )}
              </div>
          )}
          {textPositions.map((field) => {
            const text = previewData?.[field.id] as string;
            // Find the matching field in config.textFields to get color and fontFamily
            const configField = config.textFields.find(f => f.id === field.id);
            const color = configField?.color || '#000000';
            const fontFamily = configField?.fontFamily || 'Arial, sans-serif';

            return (
              <div
                key={field.id}
                className="absolute"
                style={{
                  left: `${field.left}%`,
                  top: `${field.top}%`,
                  fontSize: `${field.fontSize}px`,
                  fontWeight: field.fontWeight,
                  color: text ? color : 'transparent',
                  fontFamily,
                  whiteSpace: 'nowrap',
                  transform: 'translate(0, 0)', // Ensure no additional transforms
                  lineHeight: '1', // Consistent line height
                }}
              >
                {text || (
                  <div className="border border-dashed border-red-400 bg-red-400/20 px-1 text-red-800 rounded-sm">
                    {field.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>
    </div>
  );
}
