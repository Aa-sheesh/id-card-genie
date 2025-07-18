"use client";

import { signOut } from "firebase/auth";
import { auth, isConfigured } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Library, LogOut, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

export function Header() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    if (!isConfigured || !auth) {
      toast({
        variant: "destructive",
        title: "Configuration Error",
        description: "Firebase is not configured. Please check your .env.local file and console for more details.",
      });
      return;
    }
    try {
      if (auth) {
         await signOut(auth);
      }
      toast({
        title: "Success",
        description: "You have been logged out.",
      });
      router.push("/");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "An error occurred during logout. Please try again.",
      });
    }
  };

  const getDashboardUrl = () => {
      if (!user) return "/";
      return user.role === 'admin' ? "/admin" : "/dashboard";
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
      <nav className="flex-1">
        <Link href={getDashboardUrl()} className="flex items-center gap-2 text-lg font-semibold md:text-base">
          <Library className="h-6 w-6 text-primary" />
          <span className="font-headline text-xl">ID Card Genie</span>
        </Link>
      </nav>
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar>
                <AvatarImage src={''} alt={user.email ?? ''} />
                <AvatarFallback >
                  <UserIcon  />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
                <div className="px-2 py-1.5 text-sm">
                    <p className="font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground mt-1 break-all">UID: {user.uid}</p>
                </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
