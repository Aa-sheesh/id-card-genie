"use client";

import { useState } from "react";
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Users, Plus, Mail, Trash2 } from "lucide-react";
import type { School } from "@/lib/types";
import { AddSchoolDialog } from "./add-school-dialog";

interface SchoolListProps {
    schools: School[];
    onEditTemplate: (school: School) => void;
    onSchoolAdded: () => void;
}

export function SchoolList({ schools, onEditTemplate, onSchoolAdded }: SchoolListProps) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [loadingSchoolId, setLoadingSchoolId] = useState<string | null>(null);
    const [deletingSchoolId, setDeletingSchoolId] = useState<string | null>(null);
    const [deletingAll, setDeletingAll] = useState(false);
    const { toast } = useToast();

    const handleTriggerEmail = async (schoolId: string) => {
        setLoadingSchoolId(schoolId);
        const toastId = toast({
            title: 'Processing...',
            description: 'Generating Excel file and ZIP archive for this school. For large schools, you will receive Firebase Storage access links.',
            duration: 5000,
        });
        try {
            const res = await fetch('/api/trigger-image-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schoolId }),
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Excel & ZIP Generation Started', description: data.message });
            } else {
                if (data.error?.includes('timed out')) {
                    toast({ 
                        variant: 'destructive', 
                        title: 'Timeout Error', 
                        description: 'Too many files to process. The ZIP generation took too long.' 
                    });
                } else {
                    toast({ title: 'Error', description: data.error || 'Failed to generate Excel & ZIP files.' });
                }
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to generate Excel & ZIP files.' });
        } finally {
            setLoadingSchoolId(null);
        }
    };

    const handleDeleteImages = async (schoolId: string) => {
        setDeletingSchoolId(schoolId);
        try {
            const res = await fetch('/api/delete-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schoolId }),
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Deleted', description: `Deleted ${data.deletedCount} images for this school.` });
                if (data.errors && data.errors.length > 0) {
                    toast({ title: 'Some errors occurred', description: data.errors.join('\n') });
                }
            } else {
                toast({ title: 'Error', description: data.error || 'Failed to delete images.' });
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete images.' });
        } finally {
            setDeletingSchoolId(null);
        }
    };

    const handleDeleteAllImages = async () => {
        setDeletingAll(true);
        try {
            const res = await fetch('/api/delete-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Deleted', description: `Deleted ${data.deletedCount} images for all schools.` });
                if (data.errors && data.errors.length > 0) {
                    toast({ title: 'Some errors occurred', description: data.errors.join('\n') });
                }
            } else {
                toast({ title: 'Error', description: data.error || 'Failed to delete images.' });
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete images.' });
        } finally {
            setDeletingAll(false);
        }
    };

    return (
        <>
            <Card>
                {/* Removed Email All Images and Delete All Images buttons from above the table as requested */}
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Manage Schools</CardTitle>
                            <CardDescription>View all registered schools and manage their ID card templates.</CardDescription>
                        </div>
                        <Button onClick={() => setIsAddDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add School
                        </Button>
                    </div>
                </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>School Name</TableHead>
                            <TableHead>Login Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Template Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {schools.length > 0 ? (
                            schools.map((school) => (
                                <TableRow key={school.id}>
                                    <TableCell className="font-medium">{school.name}</TableCell>
                                    <TableCell>
                                        <code className="rounded-sm bg-muted px-1.5 py-1 text-sm">{school.adminEmail}</code>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={school.status === "active" ? "default" : "secondary"}>
                                            {school.status || "Active"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {school.templateConfig ? (
                                            <Badge variant="secondary" className="bg-green-100 text-green-800">Configured</Badge>
                                        ) : (
                                            <Badge variant="destructive">Not Configured</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right flex gap-2 justify-end">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="outline" size="sm" onClick={() => onEditTemplate(school)} aria-label="Edit Template">
                                                        <Pencil />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Edit ID Card Template</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        disabled={loadingSchoolId === school.id}
                                                        onClick={() => handleTriggerEmail(school.id)}
                                                        aria-label="Trigger Email Images"
                                                    >
                                                        {loadingSchoolId === school.id ? 'Sending...' : <Mail />}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Generate Excel & ZIP for this School (Scalable)</TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        disabled={deletingSchoolId === school.id}
                                                        onClick={() => handleDeleteImages(school.id)}
                                                        aria-label="Delete Images"
                                                    >
                                                        {deletingSchoolId === school.id ? 'Deleting...' : <Trash2 />}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Delete All Images for this School</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <Users className="h-8 w-8 text-muted-foreground" />
                                        <p className="text-muted-foreground">No schools found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        
        <AddSchoolDialog
            isOpen={isAddDialogOpen}
            setIsOpen={setIsAddDialogOpen}
            onSchoolAdded={onSchoolAdded}
        />
        </>
    );
}
