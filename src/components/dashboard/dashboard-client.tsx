"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SingleUploadForm } from "./single-upload-form";
import { TemplatePreview } from "./template-preview";
import { StudentsList } from "./students-list";
import { useAuth } from "@/hooks/use-auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, AlertTriangle } from "lucide-react";
import type { TemplateConfig, PreviewData } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

export function DashboardClient() {
  const { user } = useAuth();
  const [config, setConfig] = useState<TemplateConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchConfig = async () => {
      setLoadingConfig(true);
      if (user?.schoolId) {
        if (!db) {
          console.error("Firestore is not initialized.");
          toast({ variant: "destructive", title: "Configuration Error", description: "Cannot connect to the database." });
          setLoadingConfig(false);
          return;
        }
        try {
          const schoolDocRef = doc(db, "schools", user.schoolId);
          const schoolDocSnap = await getDoc(schoolDocRef);
          if (schoolDocSnap.exists()) {
            const schoolData = schoolDocSnap.data();
            const templateConfig = schoolData.templateConfig as TemplateConfig || null;
            setConfig(templateConfig);
          } else {
            console.log("No such school document!");
            setConfig(null);
          }
        } catch (error) {
          console.error("Error fetching school config:", error);
          setConfig(null);
        }
      }
      setLoadingConfig(false);
    };

    if (user) {
      fetchConfig();
    } else {
      setLoadingConfig(false);
    }
  }, [user, toast]);

  const handlePreviewDataChange = (data: PreviewData) => {
    setPreviewData(data);
  };
  
  const hasConfig = config && config.templateImagePath;

  const NoTemplateMessage = () => (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-yellow-400 bg-yellow-50 p-8 text-center text-yellow-900">
        <AlertTriangle className="h-12 w-12" />
        <h3 className="mt-4 text-xl font-semibold">Template Not Found</h3>
        <p className="mt-2 text-sm">
            Your account does not have an ID card template assigned.
            <br />
            Please contact your administrator to set one up.
        </p>
    </div>
);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="font-headline">Live Preview</CardTitle>
            <CardDescription>
              {hasConfig ? "This is a live preview of the ID card." : "No template assigned."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingConfig ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <TemplatePreview config={config} previewData={previewData} />
            )}
          </CardContent>
        </Card>
        

      </div>
      <div className="lg:col-span-2">
        {loadingConfig ? (
             <Card className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></Card>
        ) : hasConfig ? (
            <Tabs defaultValue="single">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="single">Single Upload</TabsTrigger>
                    <TabsTrigger value="submissions">Submissions</TabsTrigger>
                </TabsList>
                <TabsContent value="single">
                    <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Single ID Card Entry</CardTitle>
                        <CardDescription>
                        Enter the details for one ID card. The preview will update as you type.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SingleUploadForm config={config} onDataChange={handlePreviewDataChange} />
                    </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="submissions">
                    <StudentsList />
                </TabsContent>
            </Tabs>
        ) : (
            <NoTemplateMessage />
        )}
      </div>
    </div>
  );
}
