import { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";
import Navbar from "@/components/layout/Navbar";
import CreateSessionForm from "@/components/session/CreateSessionForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Copy, Trash2 } from "lucide-react";
import { getSessionLink, copyToClipboard } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface Session {
  id: string;
  name: string;
  createdAt: string;
  storiesCount: number;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { isAuthenticated, currentUser } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  // Fetch sessions
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/sessions"],
    enabled: isAuthenticated,
  });

  const sessions: Session[] = data?.sessions || [];

  const handleCopyLink = async (sessionId: string) => {
    const link = getSessionLink(sessionId);
    const success = await copyToClipboard(link);
    
    if (success) {
      toast({
        title: t("session.linkCopied"),
        description: t("session.linkCopiedMessage"),
      });
    } else {
      toast({
        title: t("session.linkCopyFailed"),
        description: t("session.linkCopyFailedMessage"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await apiRequest("DELETE", `/api/sessions/${sessionId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: t("session.deleted"),
        description: t("session.deletedMessage"),
      });
    } catch (error) {
      console.error("Error deleting session:", error);
      toast({
        title: t("session.error"),
        description: t("session.deleteError"),
        variant: "destructive",
      });
    }
  };

  const handleSessionCreate = (sessionId: string) => {
    navigate(`/session/${sessionId}`);
  };

  const handleResumeSession = (sessionId: string) => {
    navigate(`/session/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col">
      <Helmet>
        <title>{t("dashboard.pageTitle")} | {t("app.title")}</title>
      </Helmet>
      
      <Navbar />
      
      <div className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-heading font-semibold">{t("dashboard.mySessions")}</h2>
            <Button onClick={() => setCreateModalOpen(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              <span>{t("dashboard.newSession")}</span>
            </Button>
          </div>
          
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-white rounded-lg shadow-card p-6 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="h-10 bg-gray-200 rounded w-full"></div>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {t("dashboard.errorLoadingSessions")}
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-white rounded-lg shadow-card p-8 text-center">
              <h3 className="text-lg font-medium mb-2">{t("dashboard.noSessions")}</h3>
              <p className="text-muted-foreground mb-4">{t("dashboard.createFirstSession")}</p>
              <Button onClick={() => setCreateModalOpen(true)} className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                <span>{t("dashboard.createSession")}</span>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => (
                <Card 
                  key={session.id}
                  className="bg-white rounded-lg shadow-card hover:shadow-card-hover transition-shadow p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-medium">{session.name}</h3>
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleCopyLink(session.id)}
                        className="text-muted-foreground hover:text-primary transition-colors h-8 w-8"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDeleteSession(session.id)}
                        className="text-muted-foreground hover:text-red-500 transition-colors h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex items-center text-sm text-muted-foreground mb-2">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-2 h-4 w-4"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span>{t("session.createdOn", { date: formatDate(session.createdAt) })}</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-muted-foreground">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-2 h-4 w-4"
                      >
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                      </svg>
                      <span>{t("session.storiesCount", { count: session.storiesCount })}</span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => handleResumeSession(session.id)}
                    className="w-full bg-secondary hover:bg-secondary/90 text-white"
                  >
                    {t("dashboard.resume")}
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateSessionForm 
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleSessionCreate}
      />
    </div>
  );
}
