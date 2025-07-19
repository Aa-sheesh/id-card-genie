
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
import { Loader2, PlusCircle, Trash2, Save } from "lucide-react";
import { type School } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";
import { storage } from "@/lib/firebase";
import { getDownloadURL, ref } from "firebase/storage";

interface TemplateConfigDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (values: FormValues) => void;
  school: School | null;
  isSaving: boolean;
}

const formSchema = z.object({
  templateImage: z.union([z.instanceof(File), z.string()]).optional(),
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
    fontSize: z.coerce.number().min(1),
    fontWeight: z.enum(["normal", "bold"]),
  })).min(1, "At least one text field is required."),
});

export type FormValues = z.infer<typeof formSchema>;

export function TemplateConfigDialog({ isOpen, setIsOpen, onSave, school, isSaving }: TemplateConfigDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      photoPlacement: { x: 50, y: 100, width: 100, height: 120 },
      textFields: [],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "textFields",
  });

  useEffect(() => {
    if (school && isOpen) {
      const currentConfig = school.templateConfig;
      form.reset({
        templateImage: currentConfig?.templateImagePath || undefined,
        photoPlacement: currentConfig?.photoPlacement || { x: 40, y: 90, width: 150, height: 180 },
        textFields: currentConfig?.textFields || [{ id: "name", name: "Full Name", x: 220, y: 120, fontSize: 20, fontWeight: "bold" }, { id: "rollNo", name: "Roll No", x: 220, y: 160, fontSize: 16, fontWeight: "normal" }],
      });

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

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      form.setValue("templateImage", file);
      const tempUrl = URL.createObjectURL(file);
      setPreviewUrl(tempUrl);
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
      <DialogContent className=" h-[90%] max-w-4xl">

        <DialogHeader>
          <DialogTitle className="font-headline">Configure ID Card Template for {school?.name}</DialogTitle>
          <DialogDescription>
            Upload a template image and define placement for photos and text fields. The &apos;ID&apos; for each field must be a valid string, e.g., &apos;name&apos; or &apos;rollNo&apos;. All coordinates are in pixels, based on an 856x540px template.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[80vh] overflow-y-auto p-1">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg font-headline">Template Preview</h3>
              <div className="relative w-full overflow-hidden rounded-lg border bg-muted">
                {isLoadingPreview ? (
                  <div className="aspect-[85.6/54] w-full flex items-center justify-center bg-muted/50">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : previewUrl ? (
                  <Image src={previewUrl} alt="Template Preview" width={856} height={540} className="w-full h-auto aspect-[85.6/54] object-contain" data-ai-hint="id card background" />
                ) : (
                  <div className="aspect-[85.6/54] w-full flex items-center justify-center bg-muted/50">
                    <p className="text-sm text-muted-foreground">Upload an image to see a preview</p>
                  </div>
                )}
                {previewUrl && watchedValues.photoPlacement && (
                  <div
                    className="absolute border-2 border-dashed border-blue-400 bg-blue-400/20 flex items-center justify-center"
                    style={{
                      left: `${(watchedValues.photoPlacement.x / 856) * 100}%`,
                      top: `${(watchedValues.photoPlacement.y / 540) * 100}%`,
                      width: `${(watchedValues.photoPlacement.width / 856) * 100}%`,
                      height: `${(watchedValues.photoPlacement.height / 540) * 100}%`,
                    }}
                  >
                    <span className="p-1 text-xs text-blue-800 bg-white/50 rounded-sm">Photo</span>
                  </div>
                )}
                {previewUrl && watchedValues.textFields?.map((field, index) => (
                  <div
                    key={index}
                    className="absolute border border-dashed border-red-400 bg-red-400/20 px-1 text-red-800 rounded-sm"
                    style={{
                      left: `${(field.x / 856) * 100}%`,
                      top: `${(field.y / 540) * 100}%`,
                      fontSize: '8px',
                      fontWeight: field.fontWeight,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {field.name || "Untitled"}
                  </div>
                ))}
              </div>

              <FormField
                control={form.control}
                name="templateImage"
                render={() => (
                  <FormItem>
                    <FormLabel>Template Image (856x540px recommended)</FormLabel>
                    <FormControl>
                      <Input type="file" accept="image/png, image/jpeg" onChange={handleImageChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Separator />
              <h3 className="font-semibold text-lg font-headline">Photo Placement (pixels)</h3>
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="photoPlacement.x" render={({ field }) => (<FormItem><FormLabel>X</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="photoPlacement.y" render={({ field }) => (<FormItem><FormLabel>Y</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="photoPlacement.width" render={({ field }) => (<FormItem><FormLabel>Width</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="photoPlacement.height" render={({ field }) => (<FormItem><FormLabel>Height</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
              </div>
            </div>

            <div className="space-y-4">
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
                      <FormField control={form.control} name={`textFields.${index}.fontSize`} render={({ field }) => (<FormItem><FormLabel>Font Size (px)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
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
                  </div>
                ))}
                {form.formState.errors.textFields?.root && (
                  <p className="text-sm font-medium text-destructive">{form.formState.errors.textFields.root.message}</p>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ id: ``, name: "", x: 170, y: 180, fontSize: 12, fontWeight: "normal" })}>
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
