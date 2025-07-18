"use client";

import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { ImageIcon, Loader2, User } from 'lucide-react';
import type { TemplateConfig, PreviewData } from '@/lib/types';
import { storage } from '@/lib/firebase';
import { getDownloadURL, ref } from 'firebase/storage';


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

  return (
    <div className="relative w-full overflow-hidden rounded-lg border">
        <Image
            src={templateUrl}
            alt="ID Card Template"
            width={856}
            height={540}
            className="h-auto w-full"
            data-ai-hint="id card template"
            priority
        />
        {config.photoPlacement && (
             <div
                className="absolute flex items-center justify-center"
                style={{
                    left: `${(config.photoPlacement.x / 856) * 100}%`,
                    top: `${(config.photoPlacement.y / 540) * 100}%`,
                    width: `${(config.photoPlacement.width / 856) * 100}%`,
                    height: `${(config.photoPlacement.height / 540) * 100}%`,
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
        {config.textFields?.map((field) => {
            const text = previewData?.[field.id] as string;
            const leftPercent = (field.x / 856) * 100;
            const topPercent = (field.y / 540) * 100;
            
            return (
                <div
                key={field.id}
                className="absolute"
                style={{
                    left: `${leftPercent}%`,
                    top: `${topPercent}%`,
                    fontSize: hasData ? `${field.fontSize}px` : '8px',
                    fontWeight: field.fontWeight,
                    color: hasData ? '#000000' : 'transparent',
                    whiteSpace: 'nowrap',
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
  );
}
