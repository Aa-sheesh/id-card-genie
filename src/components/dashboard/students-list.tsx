"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { Loader2, Download, Eye, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StudentData {
  id: string;
  name?: string;
  rollNo?: string;
  pdfUrl?: string;
  submittedAt: Date;
  status: string;
  source?: string;
  batchId?: number;
  [key: string]: any;
}

export function StudentsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDownloadPDF = async (pdfUrl: string, studentName: string) => {
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${studentName || 'ID_Card'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Could not download the PDF. Please try again.",
      });
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
          View and download all submitted ID card PDFs.
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
                      {student.pdfUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPDF(student.pdfUrl!, student.name || 'ID_Card')}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
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