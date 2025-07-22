"use client";

import { useState, useEffect } from "react";
import type { TemplateConfig } from '@/lib/types';
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

interface StudentsListProps {
  config: TemplateConfig | null;
}

export function StudentsList({ config }: StudentsListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(config?.textFields.some(f => f.id === 'class') ? 'class' : null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

  // Sort students by selected field
  let sortedStudents = students;
  if (sortField && (sortField === 'class' || sortField === 'rollNo')) {
    sortedStudents = [...students].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      // If both are numbers, sort numerically
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      // Otherwise, sort as strings
      aVal = typeof aVal === 'string' ? aVal : (typeof aVal === 'number' ? String(aVal) : '');
      bVal = typeof bVal === 'string' ? bVal : (typeof bVal === 'number' ? String(bVal) : '');
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' })
        : bVal.localeCompare(aVal, undefined, { numeric: true, sensitivity: 'base' });
    });
  } else if (config && config.textFields.some(f => f.id === 'class')) {
    // Default sort by class desc if present
    sortedStudents = [...students].sort((a, b) => {
      const aClassRaw = a['class'];
      const bClassRaw = b['class'];
      const aClass = typeof aClassRaw === 'string' ? aClassRaw : (typeof aClassRaw === 'number' ? String(aClassRaw) : '');
      const bClass = typeof bClassRaw === 'string' ? bClassRaw : (typeof bClassRaw === 'number' ? String(bClassRaw) : '');
      return bClass.localeCompare(aClass, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  // Handle delete action
  const handleDelete = async (student: StudentData) => {
    if (!user?.schoolId || !db) return;
    try {
      // Remove Firestore document
      await (await import('firebase/firestore')).deleteDoc(
        (await import('firebase/firestore')).doc(db, `schools/${user.schoolId}/students`, student.id)
      );
      // Remove image from storage if present
      if (student.imageUrl && storage) {
        const storageRef = ref(storage, student.imageUrl);
        await (await import('firebase/storage')).deleteObject(storageRef);
      }
      setStudents(prev => prev.filter(s => s.id !== student.id));
      toast({ title: 'Deleted', description: 'Student entry deleted.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete entry.' });
    }
  };

  // Get dynamic columns from config
  const dynamicFields = config?.textFields || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Submitted ID Cards</CardTitle>
        <CardDescription>
          View and manage all submitted ID card data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sortedStudents.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                {dynamicFields.map(field => {
                  const isSortable = field.id === 'class' || field.id === 'rollNo';
                  const isSorted = sortField === field.id;
                  return (
                    <TableHead
                      key={field.id}
                      className={isSortable ? 'cursor-pointer select-none' : ''}
                      onClick={isSortable ? () => {
                        if (sortField === field.id) {
                          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField(field.id);
                          setSortDirection('desc');
                        }
                      } : undefined}
                    >
                      {field.name}
                      {isSorted && (
                        <span className="ml-1">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </TableHead>
                  );
                })}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStudents.map((student) => (
                <TableRow key={student.id}>
                  {dynamicFields.map(field => {
                    let value = student[field.id];
                    if (typeof value === 'undefined' || value === null) value = 'N/A';
                    else if (typeof value !== 'string' && typeof value !== 'number') value = String(value);
                    if (typeof value !== 'string' && typeof value !== 'number') value = 'N/A';
                    return (
                      <TableCell key={field.id} className={field.id === 'class' ? 'font-semibold' : ''}>
                        {value}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(student)}
                    >
                      Delete
                    </Button>
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