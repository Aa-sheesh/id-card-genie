"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { FileUp, Loader2, Info, Download } from "lucide-react";
import { processBulkUpload } from "@/lib/actions";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { TemplateConfig } from "@/lib/types";

const formSchema = z.object({
  excelFile: z
    .instanceof(File, { message: "Excel file is required." })
    .refine(
      (file) => file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Only .xlsx format is supported."
    ),
  zipFile: z
    .instanceof(File, { message: "ZIP file is required." })
    .refine((file) => file.type === "application/zip", "Only .zip format is supported."),
});

export function BulkUploadForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Fetch template configuration from Firestore
  useEffect(() => {
    const fetchTemplateConfig = async () => {
      if (!user?.schoolId || !db) {
        setLoadingConfig(false);
        return;
      }

      try {
        const schoolDocRef = doc(db, 'schools', user.schoolId);
        const schoolDocSnap = await getDoc(schoolDocRef);
        
        if (schoolDocSnap.exists() && schoolDocSnap.data()?.templateConfig) {
          const config = schoolDocSnap.data().templateConfig as TemplateConfig;
          setTemplateConfig(config);
        }
      } catch (error) {
        console.error("Error fetching template config:", error);
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchTemplateConfig();
  }, [user?.schoolId]);

  const downloadTemplate = () => {
    if (!templateConfig) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Template configuration not loaded. Please try again.",
      });
      return;
    }

    // Create CSV template with actual field names from admin's template
    const fieldNames = templateConfig.textFields.map(field => field.id).join(',');
    const sampleData = templateConfig.textFields.map(field => {
      // Provide sample data based on field name
      switch (field.id.toLowerCase()) {
        case 'name':
          return 'John Doe';
        case 'rollno':
        case 'roll_no':
          return '101';
        case 'class':
          return '10';
        case 'section':
          return 'A';
        case 'department':
          return 'Computer Science';
        case 'year':
          return '2024';
        default:
          return 'Sample Data';
      }
    }).join(',');
    
    const csvContent = `${fieldNames}\n${sampleData}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_data_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user?.schoolId) {
      toast({ variant: "destructive", title: "Error", description: "No school associated with this account." });
      return;
    }
    
    if (!templateConfig) {
      toast({ variant: "destructive", title: "Error", description: "Template configuration not found. Please contact admin." });
      return;
    }
    
    setIsLoading(true);

    const formData = new FormData();
    formData.append("excelFile", values.excelFile);
    formData.append("zipFile", values.zipFile);
    formData.append("schoolId", user.schoolId);

    try {
      const result = await processBulkUpload(formData);
      if (result.success) {
        toast({
          title: "Bulk Upload Successful!",
          description: result.message || `Successfully processed ${result.processedCount} students. ${result.skippedCount} students were skipped.`,
        });
        form.reset();
      } else {
        throw new Error(result.error || "An unknown error occurred.");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Could not process files. Please check them and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
        <Info className="mr-3 h-5 w-5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold">Bulk Upload Instructions</h3>
          <ul className="mt-1 list-disc pl-5 text-sm space-y-1">
            <li><strong>Excel File:</strong> Must contain columns with headers that match your template field IDs</li>
            {loadingConfig ? (
              <li className="text-muted-foreground">Loading template configuration...</li>
            ) : templateConfig ? (
              <>
                <li><strong>Required Fields:</strong> {templateConfig.textFields.map(field => field.id).join(', ')}</li>
                <li><strong>Important:</strong> One of these fields must be the roll number (rollNo, roll_no, etc.) for photo matching</li>
              </>
            ) : (
              <li className="text-red-600">Template configuration not found. Please contact admin.</li>
            )}
            <li><strong>ZIP File:</strong> Should contain photos named exactly as the roll number in your Excel file (e.g., '101.jpg', '102.png')</li>
            <li><strong>Photo Names:</strong> Must match the roll number column in your Excel file (case-sensitive)</li>
            <li><strong>Processing:</strong> Each student gets their own PDF ID card stored in the system</li>
            <li><strong>Cleanup:</strong> Original photos are automatically deleted after PDF generation to save storage costs</li>
          </ul>
        </div>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="excelFile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Excel Data File (.xlsx)</FormLabel>
                <FormControl>
                  <Input type="file" accept=".xlsx" onChange={(e) => field.onChange(e.target.files?.[0])} />
                </FormControl>
                <FormDescription>
                  {loadingConfig ? (
                    <span className="text-muted-foreground">Loading template...</span>
                  ) : templateConfig ? (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="p-0 h-auto font-normal"
                      onClick={downloadTemplate}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download template with fields: {templateConfig.textFields.map(field => field.id).join(', ')}
                    </Button>
                  ) : (
                    <span className="text-red-600">Template not configured</span>
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="zipFile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Photos ZIP File (.zip)</FormLabel>
                <FormControl>
                  <Input type="file" accept=".zip" onChange={(e) => field.onChange(e.target.files?.[0])} />
                </FormControl>
                <FormDescription>
                  Photos must be named exactly as the roll number (e.g., 101.jpg, 102.png)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button 
            type="submit" 
            disabled={isLoading || !templateConfig || loadingConfig} 
            className="w-full sm:w-auto" 
            variant="default"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            {!templateConfig ? 'Template Not Configured' : 'Upload and Process'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
