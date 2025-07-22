"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { type TemplateConfig, type PreviewData } from "@/lib/types";
import { useState, useEffect } from "react";
import { Loader2, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { generateIDCardJPG } from "@/lib/utils";

interface SingleUploadFormProps {
  config: TemplateConfig;
  onDataChange: (data: PreviewData) => void;
}

export function SingleUploadForm({ config, onDataChange }: SingleUploadFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Dynamically generate Zod schema
  const formSchema = z.object({
    ...config.textFields.reduce((acc, field) => {
      if (field.id === 'class' || field.id === 'rollNo') {
        acc[field.id] = z.coerce.number().min(1, { message: `${field.name} is required and must be a number.` });
      } else {
      acc[field.id] = z.string().min(1, { message: `${field.name} is required.` });
      }
      return acc;
    }, {} as Record<string, z.ZodTypeAny>),
    photo: z
      .instanceof(File, { message: "Photo is required." })
      .refine((file) => file.size < 1024 * 1024, "Max file size is 1MB.")
      .refine(
        (file) => ["image/jpeg", "image/png"].includes(file.type),
        "Only .jpg and .png formats are supported."
      ),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...config.textFields.reduce((acc, field) => ({ ...acc, [field.id]: "" }), {}),
      photo: undefined,
    },
  });

  // ✅ Watch form changes to update preview (no infinite re-render)
  useEffect(() => {
    const subscription = form.watch((values) => {
      onDataChange(values as PreviewData);
    });
    return () => subscription.unsubscribe();
  }, [form, onDataChange]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user?.schoolId || !db || !storage) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "User or Firebase not configured correctly.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { photo, ...textData } = values;
      const rollNo = (textData as Record<string, string>)["rollNo"];
      
      // Generate date-based filename
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const sequence = Math.floor(Math.random() * 999) + 1; // 001-999
      
      const uniqueId = rollNo ? `${rollNo}-${Date.now()}` : `entry-${Date.now()}`;

      // Get template image using API route to avoid CORS issues
      const templateResponse = await fetch(`/api/get-template?path=${encodeURIComponent(config.templateImagePath)}`);
      if (!templateResponse.ok) {
        throw new Error(`Failed to fetch template: ${templateResponse.statusText}`);
      }
      const templateBuffer = await templateResponse.arrayBuffer();

      // Process photo for PDF
      let photoBuffer: ArrayBuffer | undefined;
      if (photo) {
        photoBuffer = await photo.arrayBuffer();
      }

      // Generate JPG image
      const jpgBlob = await generateIDCardJPG(config, textData, templateBuffer, photoBuffer);

      // Upload photo temporarily for JPG generation
      const photoPath = `schools/${user.schoolId}/single_uploads/${uniqueId}/${photo.name}`;
      const photoStorageRef = ref(storage, photoPath);
      await uploadBytes(photoStorageRef, photo);

      // Upload JPG with date-based naming
      const jpgFileName = `${dateStr}-${timeStr}-${sequence.toString().padStart(3, '0')}.jpg`;
      const jpgPath = `schools/${user.schoolId}/images/${jpgFileName}`;
      const jpgStorageRef = ref(storage, jpgPath);
      const jpgSnapshot = await uploadBytes(jpgStorageRef, jpgBlob);
      const jpgUrl = await getDownloadURL(jpgSnapshot.ref);

      // Save to Firestore
      const studentDocRef = doc(db, `schools/${user.schoolId}/students`, uniqueId);
      await setDoc(studentDocRef, {
        ...textData,
        imageUrl: jpgPath, // Store the file path instead of the full URL
        imageDownloadUrl: jpgUrl, // Store the full download URL separately if needed
        submittedAt: new Date(),
        status: "submitted",
      });

      // Clean up: Delete the uploaded photo to save storage costs
      try {
        await deleteObject(photoStorageRef);
        console.log('✅ Photo deleted successfully to save storage costs');
      } catch (error) {
        console.warn('⚠️ Failed to delete photo:', error);
        // Don't fail the entire operation if photo deletion fails
      }

      // Update Excel file in storage for this school
      try {
        await fetch('/api/update-images-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolId: user.schoolId }),
        });
        console.log('✅ Excel file updated for school', user.schoolId);
      } catch (error) {
        console.warn('⚠️ Failed to update Excel file:', error);
      }

      toast({
        title: "Submission Successful",
        description: "The ID card data and image have been saved.",
      });

      form.reset();

    } catch (error) {
      console.error("Single upload failed:", error);
      console.error("Error details:", {
        templatePath: config.templateImagePath,
        photoName: values.photo?.name,
        photoType: values.photo?.type,
        errorMessage: error instanceof Error ? error.message : String(error),
        userSchoolId: user?.schoolId,
        hasDb: !!db,
        hasStorage: !!storage,
        environment: process.env.NODE_ENV
      });
      
      // More specific error message based on the error type
      let errorMessage = "Could not submit the ID card data. Please try again.";
      if (error instanceof Error) {
        if (error.message.includes('permission-denied')) {
          errorMessage = "Permission denied. Please check your authentication.";
        } else if (error.message.includes('storage')) {
          errorMessage = "Storage error. Please check your configuration.";
        } else if (error.message.includes('firestore')) {
          errorMessage = "Database error. Please try again.";
        }
      }
      
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {config.textFields.filter(field => field.id !== 'photo').map((field) => (
            <FormField
              key={field.id}
              control={form.control}
              name={field.id as keyof z.infer<typeof formSchema>}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>{field.name}</FormLabel>
                  <FormControl>
                    <Input
                      type={field.id === 'class' || field.id === 'rollNo' ? 'number' : 'text'}
                      placeholder={`Enter ${field.name}`}
                      value={typeof formField.value === 'string' || typeof formField.value === 'number' ? formField.value : ''}
                      onChange={formField.onChange}
                      onBlur={formField.onBlur}
                      name={formField.name}
                      ref={formField.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        <FormField
          control={form.control}
          name="photo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Photo</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="image/png, image/jpeg"
                  capture="environment"
                  onChange={(e) => field.onChange(e.target.files?.[0])}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormDescription>Max 1MB, PNG or JPG format.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto" variant="default">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Submit Data
        </Button>
      </form>
    </Form>
  );
}
