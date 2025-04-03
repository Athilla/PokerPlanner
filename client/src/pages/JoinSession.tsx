import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import JoinSessionForm from "@/components/session/JoinSessionForm";
import LanguageSelector from "@/components/layout/LanguageSelector";
import { joinSession } from "@/lib/websocket";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function JoinSession() {
  const { t } = useTranslation();
  const { sessionId } = useParams();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [sessionName, setSessionName] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(!!sessionId);

  // Check if session exists when session ID is provided in URL
  useEffect(() => {
    if (sessionId) {
      checkSession(sessionId);
    }
  }, [sessionId]);

  const checkSession = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("GET", `/api/sessions/${id}/check`);
      const data = await response.json();
      setSessionName(data.sessionName);
    } catch (error) {
      console.error("Error checking session:", error);
      toast({
        title: t("session.error"),
        description: t("session.sessionNotFound"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinSuccess = (participantId: string, sessionId: string, alias: string) => {
    // Store participant info in sessionStorage (not localStorage to avoid conflicts between tabs)
    sessionStorage.setItem("participant_id", participantId);
    sessionStorage.setItem("session_id", sessionId);
    sessionStorage.setItem("participant_alias", alias);
    
    // Join session via WebSocket
    joinSession(sessionId, participantId);
    
    // Navigate to session room
    navigate(`/session/${sessionId}`);
  };

  return (
    <div className="flex min-h-screen bg-neutral-100 items-center justify-center p-4">
      <Helmet>
        <title>{t("session.joinPageTitle")} | {t("app.title")}</title>
      </Helmet>
      
      {isLoading ? (
        <Card className="w-full max-w-md animate-pulse">
          <CardContent className="p-6">
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
            <div className="h-10 bg-gray-200 rounded w-full mb-4"></div>
            <div className="h-10 bg-gray-200 rounded w-full mb-4"></div>
            <div className="h-10 bg-gray-200 rounded w-full"></div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="absolute top-4 right-4">
            <LanguageSelector />
          </div>
          <JoinSessionForm 
            sessionId={sessionId} 
            sessionName={sessionName}
            onJoinSuccess={handleJoinSuccess}
          />
        </>
      )}
    </div>
  );
}
