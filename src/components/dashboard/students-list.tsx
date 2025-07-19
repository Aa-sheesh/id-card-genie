"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { Loader2, Download, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StudentData {
  id: string;
  name?: string;
  rollNo?: string;
  pdfUrl?: string;
  pdfDownloadUrl?: string;
  submittedAt: Date;
  status: string;
  source?: string;
  batchId?: number;
  imageUrl?: string;
  imageDownloadUrl?: string;
  [key: string]: unknown;
}

export function StudentsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!user?.schoolId || !db) {
        setLoading(false);
        return;
      }

      try {
        const studentsQuery = query(
          collection(db, `schools/${user.schoolId}/students`),
          orderBy("submittedAt", "desc")
        );
        const snapshot = await getDocs(studentsQuery);
        const studentsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          submittedAt: doc.data().submittedAt?.toDate() || new Date(),
        })) as StudentData[];
        
        setStudents(studentsList);
      } catch (error) {
        console.error("Error fetching students:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not fetch submitted data.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [user?.schoolId, toast]);

  const handleDownloadImage = async (student: StudentData) => {
    if (!storage) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Storage not configured.",
      });
      return;
    }

    setDownloadingPdf(student.id);

    try {
      let downloadUrl: string;

      // Check if we have a direct download URL first
      if (student.imageDownloadUrl) {
        downloadUrl = student.imageDownloadUrl;
      } else if (student.imageUrl) {
        // If we have a file path, get the download URL from Firebase Storage
        const storageRef = ref(storage, student.imageUrl);
        downloadUrl = await getDownloadURL(storageRef);
      } else {
        throw new Error("No image URL available");
      }

      // Fetch the image file
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${student.name || 'ID_Card'}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Successful",
        description: "ID card image has been downloaded successfully.",
      });

    } catch (error) {
      console.error("Error downloading image:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Could not download the image. Please try again.",
      });
    } finally {
      setDownloadingPdf(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Submitted ID Cards</CardTitle>
        <CardDescription>
          View and download all submitted ID card images.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {students.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Roll No</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">
                    {student.name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {student.rollNo || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={student.source === 'bulk_upload' ? 'default' : 'outline'}>
                      {student.source === 'bulk_upload' ? 'Bulk Upload' : 'Single Upload'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={student.status === 'submitted' ? 'secondary' : 'outline'}>
                      {student.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(student.submittedAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {(student.imageUrl || student.imageDownloadUrl) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadImage(student)}
                          disabled={downloadingPdf === student.id}
                        >
                          {downloadingPdf === student.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-2 h-4 w-4" />
                          )}
                          {downloadingPdf === student.id ? "Downloading..." : "Download Image"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No submissions yet</h3>
            <p className="text-muted-foreground">
              Submitted ID cards will appear here once you start uploading data.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 