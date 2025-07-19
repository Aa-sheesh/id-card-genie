"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Users, Plus } from "lucide-react";
import type { School } from "@/lib/types";
import { AddSchoolDialog } from "./add-school-dialog";

interface SchoolListProps {
    schools: School[];
    onEditTemplate: (school: School) => void;
    onSchoolAdded: () => void;
}

export function SchoolList({ schools, onEditTemplate, onSchoolAdded }: SchoolListProps) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    return (
        <>
            <Card>
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
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => onEditTemplate(school)}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            {school.templateConfig ? "Edit Template" : "Set Template"}
                                        </Button>
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
