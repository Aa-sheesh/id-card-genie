"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2, Plus } from "lucide-react";

const formSchema = z.object({
  schoolName: z.string().min(2, {
    message: "School name must be at least 2 characters.",
  }),
  adminEmail: z.string().email({
    message: "Please enter a valid email address.",
  }),
  adminPassword: z.string().min(6, {
    message: "Password must be at least 6 characters.",
  }),
  confirmPassword: z.string(),
}).refine((data) => data.adminPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type AddSchoolFormValues = z.infer<typeof formSchema>;

interface AddSchoolDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSchoolAdded: () => void;
}

export function AddSchoolDialog({ isOpen, setIsOpen, onSchoolAdded }: AddSchoolDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AddSchoolFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      schoolName: "",
      adminEmail: "",
      adminPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: AddSchoolFormValues) {
    setIsLoading(true);

    if (!auth || !db) {
      toast({
        variant: "destructive",
        title: "Configuration Error",
        description: "Firebase is not configured. Please check your setup.",
      });
      setIsLoading(false);
      return;
    }

    try {
      // Create Firebase Authentication user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.adminEmail,
        values.adminPassword
      );

      const { user } = userCredential;

      // Create school document with custom ID
      const customSchoolId = values.schoolName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const schoolDocRef = doc(db, "schools", customSchoolId);
      
      await setDoc(schoolDocRef, {
        id: customSchoolId,
        name: values.schoolName,
        adminEmail: values.adminEmail, // Keep for backward compatibility
        loginEmail: values.adminEmail, // New field name
        adminUid: user.uid,
        createdAt: new Date(),
        status: "active",
      });

      // Create user document for the school (regular user, not admin)
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        email: values.adminEmail,
        role: "user", // Regular user, not admin
        schoolId: customSchoolId,
        createdAt: new Date(),
      });

      toast({
        title: "School Created Successfully!",
        description: `School "${values.schoolName}" has been created with login credentials.`,
      });

      form.reset();
      setIsOpen(false);
      onSchoolAdded();

    } catch (error: unknown) {
      console.error("Error creating school:", error);
      let errorMessage = "Failed to create school. Please try again.";
      
      if (error && typeof error === 'object' && 'code' in error) {
        const errorCode = error.code as string;
        if (errorCode === 'auth/email-already-in-use') {
          errorMessage = "An account with this email already exists.";
        } else if (errorCode === 'auth/weak-password') {
          errorMessage = "Password is too weak. Please choose a stronger password.";
        } else if (errorCode === 'auth/invalid-email') {
          errorMessage = "Invalid email address.";
        }
      }
      
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Add New School</DialogTitle>
          <DialogDescription>
            Create a new school and assign login credentials. The school will be able to log in and manage their own ID card templates.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="schoolName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter school name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="adminEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Login Email</FormLabel>
                  <FormControl>
                    <Input placeholder="school@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="adminPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Login Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create School
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 