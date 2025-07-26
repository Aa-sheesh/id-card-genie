
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Loader2, PlusCircle, Trash2, Save, Info } from "lucide-react";
import { type School, PROFESSIONAL_FONTS, PROFESSIONAL_COLORS } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { storage } from "@/lib/firebase";
import { getDownloadURL, ref } from "firebase/storage";
import { getImageDimensions, calculateDefaultPositions } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { verifyCoordinateCalculations, calculateFieldPositions } from "@/lib/utils";

interface TemplateConfigDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (values: FormValues) => void;
  school: School | null;
  isSaving: boolean;
}

const formSchema = z.object({
  templateImage: z.union([z.instanceof(File), z.string()]).optional(),
  templateDimensions: z.object({
    width: z.coerce.number().min(1),
    height: z.coerce.number().min(1),
  }),
  photoPlacement: z.object({
    x: z.coerce.number().min(0),
    y: z.coerce.number().min(0),
    width: z.coerce.number().min(1),
    height: z.coerce.number().min(1),
  }),
  textFields: z.array(z.object({
    id: z.string().min(1, "ID must be a valid string, e.g., 'name' or 'rollNo'."),
    name: z.string().min(1, "Field name is required."),
    x: z.coerce.number().min(0),
    y: z.coerce.number().min(0),
    width: z.coerce.number().min(1).optional(),
    lines: z.coerce.number().min(0.1).default(1), // Allow decimal lines >= 0.1
    fontSize: z.coerce.number().min(1),
    fontWeight: z.enum(["normal", "bold"]),
    color: z.string().min(1, "Color is required."),
    fontFamily: z.string().min(1, "Font family is required."),
    textAlign: z.enum(["left", "center", "right"]).default("left"),
  })).min(1, "At least one text field is required."),
});

export type FormValues = z.infer<typeof formSchema>;

// Helper function to get realistic sample text based on field type
function getSampleText(fieldId: string): string {
  const sampleTexts: Record<string, string> = {
    name: "John Doe",
    rollNo: "2024001",
    class: "Class 10",
    contact: "+91 98765 43210",
    address: "123 Main Street, City",
    fatherName: "Father's Name",
    motherName: "Mother's Name",
    dob: "01/01/2000",
    bloodGroup: "O+",
    section: "A",
    admissionNo: "ADM001",
    email: "student@school.com",
    emergencyContact: "Emergency Contact",
    default: "Sample Text"
  };
  
  return sampleTexts[fieldId] || sampleTexts.default;
}

export function TemplateConfigDialog({ isOpen, setIsOpen, onSave, school, isSaving }: TemplateConfigDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      templateDimensions: { width: 856, height: 540 },
      photoPlacement: { x: 68, y: 135, width: 171, height: 162 }, // Updated to match new calculation
      textFields: [
        { id: "name", name: "Full Name", x: 274, y: 162, fontSize: 18, fontWeight: "bold" as const, color: "#000000", fontFamily: "Arial, sans-serif", lines: 1, textAlign: "left" },
        { id: "rollNo", name: "Roll No", x: 274, y: 216, fontSize: 16, fontWeight: "normal" as const, color: "#333333", fontFamily: "Arial, sans-serif", lines: 1, textAlign: "left" },
        { id: "class", name: "Class", x: 274, y: 270, fontSize: 16, fontWeight: "normal" as const, color: "#333333", fontFamily: "Arial, sans-serif", lines: 1, textAlign: "left" },
        { id: "contact", name: "Contact", x: 274, y: 324, fontSize: 16, fontWeight: "normal" as const, color: "#333333", fontFamily: "Arial, sans-serif", lines: 1, textAlign: "left" },
        { id: "address", name: "Address", x: 274, y: 378, fontSize: 14, fontWeight: "normal" as const, color: "#333333", fontFamily: "Arial, sans-serif", lines: 1, textAlign: "left" }
      ],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "textFields",
  });

  useEffect(() => {
    if (school && isOpen) {
      const currentConfig = school.templateConfig;
      if (currentConfig) {
        form.reset({
          templateImage: currentConfig.templateImagePath || undefined,
          templateDimensions: currentConfig.templateDimensions || { width: 856, height: 540 },
          photoPlacement: currentConfig.photoPlacement,
          textFields: currentConfig.textFields,
        });

      } else {
        // Use default values for new template
        const defaultDimensions = { width: 856, height: 540 };
        form.reset({
          templateImage: undefined,
          templateDimensions: { width: defaultDimensions.width, height: defaultDimensions.height },
          photoPlacement: { x: 68, y: 135, width: 171, height: 162 }, // Updated to match new calculation
          textFields: [
            { id: "name", name: "Full Name", x: 274, y: 162, fontSize: 18, fontWeight: "bold" as const, color: "#000000", fontFamily: "Arial, sans-serif", lines: 1, textAlign: "left" },
            { id: "rollNo", name: "Roll No", x: 274, y: 216, fontSize: 16, fontWeight: "normal" as const, color: "#333333", fontFamily: "Arial, sans-serif", lines: 1, textAlign: "left" },
            { id: "class", name: "Class", x: 274, y: 270, fontSize: 16, fontWeight: "normal" as const, color: "#333333", fontFamily: "Arial, sans-serif", lines: 1, textAlign: "left" },
            { id: "contact", name: "Contact", x: 274, y: 324, fontSize: 16, fontWeight: "normal" as const, color: "#333333", fontFamily: "Arial, sans-serif", lines: 1, textAlign: "left" },
            { id: "address", name: "Address", x: 274, y: 378, fontSize: 14, fontWeight: "normal" as const, color: "#333333", fontFamily: "Arial, sans-serif", lines: 1, textAlign: "left" }
          ],
        });

      }

      const fetchInitialPreview = async () => {
        const imagePath = school.templateConfig?.templateImagePath;
        if (imagePath && storage) {
          setIsLoadingPreview(true);
          try {
            const url = await getDownloadURL(ref(storage, imagePath));
            setPreviewUrl(url);
          } catch (e) {
            console.warn("Admin preview failed. This can happen if the admin role doesn't have read access to all school templates, which is acceptable.", e);
            setPreviewUrl(null);
          } finally {
            setIsLoadingPreview(false);
          }
        } else {
          setPreviewUrl(null);
          setIsLoadingPreview(false);
        }
      };
      fetchInitialPreview();
    }
  }, [school, isOpen, form]);

  const watchedValues = form.watch();
  const currentDimensions = watchedValues.templateDimensions;

  // Calculate field positions consistently for preview
  const mockConfig = currentDimensions && watchedValues.photoPlacement && watchedValues.textFields ? {
    templateImagePath: '',
    templateDimensions: currentDimensions,
    photoPlacement: watchedValues.photoPlacement,
    textFields: watchedValues.textFields,
  } : null;
  
  const { photoPositions, textPositions } = mockConfig ? calculateFieldPositions(mockConfig, 'preview') : { photoPositions: null, textPositions: [] };

  // Enhanced debug logging for admin coordinate calculations
  useEffect(() => {
    if (watchedValues.photoPlacement && watchedValues.textFields && currentDimensions) {
      const templateWidth = currentDimensions.width;
      const templateHeight = currentDimensions.height;
      
      console.log("🎯 ADMIN DASHBOARD - Template config using values:", {
        photoPlacement: watchedValues.photoPlacement,
        textFields: watchedValues.textFields,
        templateDimensions: currentDimensions,
        calculatedPercentages: {
          photo: {
            left: `${(watchedValues.photoPlacement.x / templateWidth) * 100}%`,
            top: `${(watchedValues.photoPlacement.y / templateHeight) * 100}%`,
            width: `${(watchedValues.photoPlacement.width / templateWidth) * 100}%`,
            height: `${(watchedValues.photoPlacement.height / templateHeight) * 100}%`,
          },
          textFields: watchedValues.textFields.map(field => ({
            id: field.id,
            left: `${(field.x / templateWidth) * 100}%`,
            top: `${(field.y / templateHeight) * 100}%`,
            fontSize: field.fontSize,
            fontWeight: field.fontWeight,
            textAlign: field.textAlign
          }))
        }
      });
      
      // Verify coordinate calculations
      const mockConfig = {
        templateImagePath: '',
        templateDimensions: currentDimensions,
        photoPlacement: watchedValues.photoPlacement,
        textFields: watchedValues.textFields,
      };
      verifyCoordinateCalculations(mockConfig, 'admin');
    }
  }, [watchedValues, currentDimensions]);

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      
      try {
        // Get actual image dimensions
        const dimensions = await getImageDimensions(file);
        
        // Calculate default positions based on actual dimensions
        const { photoPlacement, textFields } = calculateDefaultPositions(dimensions.width, dimensions.height);
        
        // Update form with new dimensions and calculated positions
        form.setValue("templateImage", file);
        form.setValue("templateDimensions", dimensions);
        form.setValue("photoPlacement", photoPlacement);
        form.setValue("textFields", textFields);
        
        const tempUrl = URL.createObjectURL(file);
        setPreviewUrl(tempUrl);
        
        console.log("📐 Image dimensions detected:", dimensions);
        console.log("📍 Calculated default positions:", { photoPlacement, textFields });
      } catch (error) {
        console.error("Failed to get image dimensions:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to process image. Please try again.",
        });
      }
    }
  };

  function onSubmit(values: FormValues) {
    if (!values.templateImage && !school?.templateConfig?.templateImagePath) {
      form.setError("templateImage", { type: "manual", message: "A template image is required." })
      return;
    }
    onSave(values);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setIsOpen(open);
    }}>
      <DialogContent className="h-[90%] max-w-6xl">
        <DialogHeader>
          <DialogTitle className="font-headline">Configure ID Card Template for {school?.name}</DialogTitle>
          <DialogDescription>
            Upload a template image and define placement for photos and text fields. Field positions will be automatically calculated based on the uploaded image dimensions.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-h-[80vh] overflow-y-auto p-1">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg font-headline">Template Preview</h3>
                {currentDimensions && (
                  <div className="text-sm text-muted-foreground">
                    Dimensions: {currentDimensions.width} × {currentDimensions.height}px
                  </div>
                )}
              </div>
              
              <div className="relative w-full overflow-hidden rounded-lg border bg-muted">
                {isLoadingPreview ? (
                  <div className="aspect-[85.6/54] w-full flex items-center justify-center bg-muted/50">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : previewUrl ? (
                  <div 
                    className="relative w-full"
                    style={{
                      aspectRatio: currentDimensions ? `${currentDimensions.width}/${currentDimensions.height}` : '85.6/54',
                      maxWidth: '100%',
                      maxHeight: '100%'
                    }}
                  >
                    <Image 
                      src={previewUrl} 
                      alt="Template Preview" 
                      width={currentDimensions?.width || 856} 
                      height={currentDimensions?.height || 540} 
                      className="w-full h-full object-contain" 
                      style={{
                        aspectRatio: currentDimensions ? `${currentDimensions.width}/${currentDimensions.height}` : '85.6/54'
                      }}
                      data-ai-hint="id card background" 
                    />
                    
                    {photoPositions && (
                      <div
                        className="absolute border-2 border-dashed border-blue-400 bg-blue-400/20 flex items-center justify-center"
                        style={{
                          left: `${photoPositions.left}%`,
                          top: `${photoPositions.top}%`,
                          width: `${photoPositions.width}%`,
                          height: `${photoPositions.height}%`,
                        }}
                      >
                        <span className="p-1 text-xs text-blue-800 bg-white/50 rounded-sm">Photo</span>
                      </div>
                    )}
                    
                    {textPositions.map((field, index) => {
                      const widthPx = watchedValues.textFields?.[index]?.width;
                      const fontSize = watchedValues.textFields?.[index]?.fontSize || 12;
                      const lines = watchedValues.textFields?.[index]?.lines || 1;
                      const textAlign = watchedValues.textFields?.[index]?.textAlign || "left";
                      const templateW = currentDimensions?.width || 856;
                      const templateH = currentDimensions?.height || 540;
                      const widthPercent = widthPx ? (widthPx / templateW) * 100 : undefined;
                      const heightPx = fontSize * 1.2 * lines;
                      return (
                        <div
                          key={index}
                          className="absolute border border-dashed border-red-400 bg-red-400/20 px-1 text-red-800 rounded-sm"
                          style={{
                            left: `${field.left}%`,
                            top: `${field.top}%`,
                            width: widthPercent ? `${widthPercent}%` : undefined,
                            height: `${heightPx}px`,
                            fontSize: `${fontSize}px`,
                            fontWeight: watchedValues.textFields?.[index]?.fontWeight || 'normal',
                            color: watchedValues.textFields?.[index]?.color || '#000000',
                            fontFamily: watchedValues.textFields?.[index]?.fontFamily || 'Arial, sans-serif',
                            whiteSpace: widthPercent ? 'pre-wrap' : 'nowrap',
                            overflow: widthPercent ? 'hidden' : undefined,
                            lineHeight: '1.2',
                            display: 'block',
                            alignItems: 'flex-start',
                            justifyContent: 'flex-start',
                            background: 'rgba(255,255,255,0.7)',
                            textAlign: textAlign,
                            wordWrap: widthPercent ? 'break-word' : 'normal',
                          }}
                        >
                          <span style={{
                            textAlign: textAlign, 
                            width: '100%', 
                            display: 'inline-block',
                            whiteSpace: widthPercent ? 'pre-wrap' : 'nowrap',
                            wordWrap: widthPercent ? 'break-word' : 'normal',
                          }}>
                            {getSampleText(watchedValues.textFields?.[index]?.id || 'name')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="aspect-[85.6/54] w-full flex items-center justify-center bg-muted/50">
                    <p className="text-sm text-muted-foreground">Upload an image to see a preview</p>
                  </div>
                )}
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Field positions are automatically calculated based on your uploaded image dimensions. 
                  You can adjust them manually using the controls on the right.
                </AlertDescription>
              </Alert>

              <FormField
                control={form.control}
                name="templateImage"
                render={() => (
                  <FormItem>
                    <FormLabel>Template Image</FormLabel>
                    <FormControl>
                      <Input type="file" accept="image/png, image/jpeg" onChange={handleImageChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg font-headline">Photo Placement (pixels)</h3>
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="photoPlacement.x" render={({ field }) => (<FormItem><FormLabel>X</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="photoPlacement.y" render={({ field }) => (<FormItem><FormLabel>Y</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="photoPlacement.width" render={({ field }) => (<FormItem><FormLabel>Width</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="photoPlacement.height" render={({ field }) => (<FormItem><FormLabel>Height</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
              </div>

              <Separator />

              <h3 className="font-semibold text-lg font-headline">Text Fields</h3>
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 border-l pl-4">
                {fields.map((item, index) => (
                  <div key={item.id} className="p-4 border rounded-md relative space-y-2 bg-background">
                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => remove(index)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    <FormField control={form.control} name={`textFields.${index}.id`} render={({ field }) => (<FormItem><FormLabel>Field ID (matches Excel header)</FormLabel><FormControl><Input placeholder="e.g. rollNo" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name={`textFields.${index}.name`} render={({ field }) => (<FormItem><FormLabel>Display Name</FormLabel><FormControl><Input placeholder="e.g. Roll Number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-2 gap-2">
                      <FormField control={form.control} name={`textFields.${index}.x`} render={({ field }) => (<FormItem><FormLabel>X</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                      <FormField control={form.control} name={`textFields.${index}.y`} render={({ field }) => (<FormItem><FormLabel>Y</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                      <FormField control={form.control} name={`textFields.${index}.width`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Width (px)</FormLabel>
                          <FormControl><Input type="number" min="1" {...field} value={field.value ?? ""} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`textFields.${index}.textAlign`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Text Align</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || "left"}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select alignment" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="left">Left</SelectItem>
                              <SelectItem value="center">Center</SelectItem>
                              <SelectItem value="right">Right</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`textFields.${index}.lines`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of lines</FormLabel>
                          <FormControl><Input type="number" min="0.1" step="0.1" {...field} value={field.value ?? 1} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`textFields.${index}.fontSize`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Font Size (px)</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Input type="number" {...field} min="8" max="48" />
                              <input 
                                type="range" 
                                min="8" 
                                max="48" 
                                value={field.value || 12}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <div className="flex gap-1 flex-wrap">
                                {[10, 12, 14, 16, 18, 20, 24].map((size) => (
                                  <button
                                    key={size}
                                    type="button"
                                    onClick={() => field.onChange(size)}
                                    className={`px-2 py-1 text-xs rounded border ${
                                      field.value === size 
                                        ? 'bg-primary text-primary-foreground' 
                                        : 'bg-background hover:bg-muted'
                                    }`}
                                  >
                                    {size}px
                                  </button>
                                ))}
                              </div>
                            </div>
                          </FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`textFields.${index}.fontWeight`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Font Weight</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select weight" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="bold">Bold</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                      />
                    </div>
                    
                    {/* Color and Font Selection */}
                    <div className="grid grid-cols-2 gap-2">
                      <FormField control={form.control} name={`textFields.${index}.color`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Text Color</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select color" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(PROFESSIONAL_COLORS).map(([key, color]) => (
                                <SelectItem key={key} value={color.value}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-4 h-4 rounded border" 
                                      style={{ backgroundColor: color.value }}
                                    />
                                    {color.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                      />
                      <FormField control={form.control} name={`textFields.${index}.fontFamily`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Font Family</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select font" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(PROFESSIONAL_FONTS).map(([key, font]) => (
                                <SelectItem key={key} value={font.value}>
                                  <span style={{ fontFamily: font.value }}>{font.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                      />
                    </div>
                    

                    
                    {/* Live Font Preview */}
                    <div className="mt-3 p-3 bg-muted/50 rounded-md border">
                      <FormLabel className="text-sm font-medium mb-2 block">Font Preview</FormLabel>
                      <div 
                        className="bg-white p-2 rounded border"
                        style={{
                          fontSize: `${watchedValues.textFields?.[index]?.fontSize || 12}px`,
                          fontWeight: watchedValues.textFields?.[index]?.fontWeight || 'normal',
                          fontFamily: watchedValues.textFields?.[index]?.fontFamily || 'Arial, sans-serif',
                          color: watchedValues.textFields?.[index]?.color || '#000000',
                          lineHeight: '1.2',
                          minHeight: '2em',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {getSampleText(watchedValues.textFields?.[index]?.id || 'name')}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                        <span>Font: {watchedValues.textFields?.[index]?.fontWeight || 'normal'} {watchedValues.textFields?.[index]?.fontSize || 12}px</span>
                        <span>Field: {watchedValues.textFields?.[index]?.name || 'Untitled'}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex justify-between">
                        <span>Color: {Object.entries(PROFESSIONAL_COLORS).find(([, color]) => color.value === watchedValues.textFields?.[index]?.color)?.[1]?.label || 'Custom'}</span>
                        <span>Font: {Object.entries(PROFESSIONAL_FONTS).find(([, font]) => font.value === watchedValues.textFields?.[index]?.fontFamily)?.[1]?.label || 'Custom'}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {form.formState.errors.textFields?.root && (
                  <p className="text-sm font-medium text-destructive">{form.formState.errors.textFields.root.message}</p>
                )}
              </div>
                              <Button type="button" variant="outline" size="sm" onClick={() => append({ id: ``, name: "", x: 170, y: 180, fontSize: 12, fontWeight: "normal", color: "#333333", fontFamily: "Arial, sans-serif", lines: 1, textAlign: "left" })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Field
              </Button>
            </div>
          </form>
        </Form>
        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={isSaving} variant="outline">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
