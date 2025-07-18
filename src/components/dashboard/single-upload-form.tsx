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
import { generateIDCardPDF } from "@/lib/utils";

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
      acc[field.id] = z.string().min(1, { message: `${field.name} is required.` });
      return acc;
    }, {} as Record<string, z.ZodString>),
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
      const uniqueId = rollNo ? `${rollNo}-${Date.now()}` : `entry-${Date.now()}`;

      // Get template image
      const templateRef = ref(storage, config.templateImagePath);
      const templateUrl = await getDownloadURL(templateRef);
      const templateResponse = await fetch(templateUrl);
      const templateBuffer = await templateResponse.arrayBuffer();

      // Process photo for PDF
      let photoBuffer: ArrayBuffer | undefined;
      if (photo) {
        photoBuffer = await photo.arrayBuffer();
      }

      // Generate PDF
      const pdfBytes = await generateIDCardPDF(config, textData, templateBuffer, photoBuffer);

      // Upload photo temporarily for PDF generation
      const photoPath = `schools/${user.schoolId}/single_uploads/${uniqueId}/${photo.name}`;
      const photoStorageRef = ref(storage, photoPath);
      const photoSnapshot = await uploadBytes(photoStorageRef, photo);
      const photoUrl = await getDownloadURL(photoSnapshot.ref);

      // Upload PDF
      const pdfPath = `schools/${user.schoolId}/pdfs/${uniqueId}/id_card.pdf`;
      const pdfStorageRef = ref(storage, pdfPath);
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const pdfSnapshot = await uploadBytes(pdfStorageRef, pdfBlob);
      const pdfUrl = await getDownloadURL(pdfSnapshot.ref);

      // Save to Firestore
      const studentDocRef = doc(db, `schools/${user.schoolId}/students`, uniqueId);
      await setDoc(studentDocRef, {
        ...textData,
        pdfUrl, // Only store PDF URL, not photo URL
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

      toast({
        title: "Submission Successful",
        description: "The ID card data and PDF have been saved.",
      });

      form.reset();

    } catch (error) {
      console.error("Single upload failed:", error);
      console.error("Error details:", {
        templatePath: config.templateImagePath,
        photoName: values.photo?.name,
        photoType: values.photo?.type,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Could not submit the ID card data. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {config.textFields.map((field) => (
            <FormField
              key={field.id}
              control={form.control}
              name={field.id as any}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>{field.name}</FormLabel>
                  <FormControl>
                    <Input placeholder={`Enter ${field.name}`} {...formField} />
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
                  onChange={(e) => field.onChange(e.target.files?.[0])}
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
