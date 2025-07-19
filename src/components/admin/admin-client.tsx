"use client";

import { useState, useEffect } from "react";
import type { School, TemplateConfig } from "@/lib/types";
import { SchoolList } from "./school-list";
import { TemplateConfigDialog, type FormValues } from "../dashboard/template-config-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db, auth, isConfigured, storage } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, query, orderBy } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminClient() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isTriggeringEmail, setIsTriggeringEmail] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSchools = async () => {
      if (!isConfigured || !db) {
        toast({
          variant: "destructive",
          title: "Configuration Error",
          description: "Firebase is not configured. Please check your .env.local file.",
        });
        setLoading(false);
        return;
      }
      try {
        const schoolsQuery = query(collection(db, "schools"), orderBy("name"));
        const schoolSnapshot = await getDocs(schoolsQuery);
        const schoolList = schoolSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as School)
        );
        setSchools(schoolList);
      } catch (error) {
        console.error("Error fetching schools:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Could not fetch schools.";
        toast({
          variant: "destructive",
          title: "Error",
          description: `${errorMessage} This may be a permissions or configuration issue.`,
        });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchSchools();
    }
  }, [user, toast]);

  const handleEditTemplate = (school: School) => {
    setEditingSchool(school);
    setIsConfigDialogOpen(true);
  };

  const handleSaveTemplate = async (values: FormValues) => {
    if (!editingSchool || !isConfigured || !db || !storage) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "System not ready or not logged in.",
      });
      return;
    }

    setIsSaving(true);
    const schoolId = editingSchool.id;
    const schoolNameForToast = editingSchool.name;

    try {
      if (auth?.currentUser) {
        await auth.currentUser.getIdToken(true); // Refresh token
      } else {
        throw new Error("No authenticated user found.");
      }

      const { templateImage, ...configData } = values;
      let finalImagePath = editingSchool.templateConfig?.templateImagePath || '';

      if (templateImage && templateImage instanceof File) {
        const filePath = `schools/${schoolId}/template.jpg`;
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, templateImage);
        finalImagePath = filePath;
        console.log("✅ Uploaded template image to:", finalImagePath);
      }

      if (!finalImagePath) {
        throw new Error("Template image is missing. Please upload one.");
      }

      const newConfig: TemplateConfig = {
        templateImagePath: finalImagePath,
        templateDimensions: configData.templateDimensions,
        photoPlacement: configData.photoPlacement,
        textFields: configData.textFields,
      };

      console.log("💾 Saving template config:", newConfig);

      const schoolDocRef = doc(db, "schools", schoolId);
      await setDoc(schoolDocRef, { templateConfig: newConfig }, { merge: true });

      setSchools((prev) =>
        prev.map((s) =>
          s.id === schoolId ? { ...s, templateConfig: newConfig } : s
        )
      );

      toast({
        title: "Success",
        description: `Template for ${schoolNameForToast} saved successfully.`,
      });

      // ✅ Reset UI state
      setIsConfigDialogOpen(false);
      setEditingSchool(null);
    } catch (error) {
      console.error("❌ Error saving template:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: `Error: ${errorMessage}. This may be caused by Firebase Security Rules.`,
      });
    } finally {
      setIsSaving(false);
      console.log("✅ Finished save operation");
    }
  };

  const handleTriggerImageEmail = async () => {
    setIsTriggeringEmail(true);
    try {
      const response = await fetch('/api/trigger-image-email', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin', // Simple auth for now
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast({
          title: "Email Check Triggered",
          description: "Image email check has been triggered successfully.",
        });
      } else {
        throw new Error('Failed to trigger email check');
      }
    } catch (error) {
      console.error('Error triggering image email check:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to trigger image email check.",
      });
    } finally {
      setIsTriggeringEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PDF Email Trigger Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleTriggerImageEmail}
          disabled={isTriggeringEmail}
          variant="outline"
          className="flex items-center gap-2"
        >
          {isTriggeringEmail ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {isTriggeringEmail ? "Checking..." : "Trigger Image Email Check"}
        </Button>
      </div>

      <SchoolList 
        schools={schools} 
        onEditTemplate={handleEditTemplate} 
        onSchoolAdded={() => {
          // Refresh the schools list
          const fetchSchools = async () => {
            if (!db) return;
            try {
              const schoolsQuery = query(collection(db, "schools"), orderBy("name"));
              const schoolSnapshot = await getDocs(schoolsQuery);
              const schoolList = schoolSnapshot.docs.map(
                (doc) => ({ id: doc.id, ...doc.data() } as School)
              );
              setSchools(schoolList);
            } catch (error) {
              console.error("Error fetching schools:", error);
            }
          };
          fetchSchools();
        }}
      />

      {editingSchool && (
        <TemplateConfigDialog
          isOpen={isConfigDialogOpen}
          setIsOpen={setIsConfigDialogOpen}
          onSave={handleSaveTemplate}
          school={editingSchool}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
