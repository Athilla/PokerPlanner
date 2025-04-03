import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import LanguageSelector from "@/components/layout/LanguageSelector";
import { LogOut, User } from "lucide-react";

interface NavbarProps {
  sessionName?: string;
  participantName?: string;
  onCopyLink?: () => void;
  onLeaveSession?: () => void;
}

export default function Navbar({ sessionName, participantName, onCopyLink, onLeaveSession }: NavbarProps) {
  const { t } = useTranslation();
  const { currentUser, logout } = useAuth();
  const [, navigate] = useLocation();
  const isAuthenticated = !!currentUser;
  const isInSession = !!sessionName;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleLeaveSession = () => {
    if (onLeaveSession) {
      onLeaveSession();
    } else {
      navigate("/");
    }
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center py-4">
          <div className="flex items-center mb-4 md:mb-0">
            <h1 className="text-xl font-heading font-semibold text-primary mr-3">
              {t("app.title")}
            </h1>
            {sessionName && (
              <span className="px-3 py-1 bg-neutral-100 rounded-md text-sm">
                {sessionName}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {isInSession && onCopyLink && (
              <Button 
                variant="outline" 
                onClick={onCopyLink} 
                className="text-sm"
                size="sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                {t("session.copyLink")}
              </Button>
            )}
            
            <LanguageSelector />
            
            {isAuthenticated && !participantName && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center">
                    <span className="mr-2 hidden sm:inline">{currentUser.email}</span>
                    <div className="h-8 w-8 rounded-full bg-primary-light flex items-center justify-center text-white">
                      <User className="h-4 w-4" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("auth.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {participantName && (
              <div className="flex items-center">
                <span className="text-sm mr-2 hidden sm:inline">{t("session.connectedAs")}</span>
                <span className="font-medium">{participantName}</span>
              </div>
            )}
            
            {isInSession && (
              <Button 
                variant="ghost" 
                onClick={handleLeaveSession} 
                className="text-sm text-red-500 hover:text-red-700 hover:bg-red-50"
                size="sm"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{t("session.leave")}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
