import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useWebSocket } from "@/context/WebSocketContext";
import { closeWebSocketConnection, hostJoinSession } from "@/lib/websocket";
import { getSessionLink, copyToClipboard } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/layout/Navbar";
import UserStoryItem, { UserStory } from "@/components/session/UserStoryItem";
import ParticipantsList, { Participant } from "@/components/session/ParticipantsList";
import VotingArea from "@/components/session/VotingArea";
import VoteResults from "@/components/session/VoteResults";
import SessionResults from "@/components/session/SessionResults";
import useSessionWebSocket from "@/hooks/useSessionWebSocket";

interface Vote {
  id: number;
  participantId: string;
  userStoryId: number;
  value: number;
}

interface Session {
  id: string;
  name: string;
  hostId: number;
  scale: string;
  notificationsEnabled: boolean;
}

export default function SessionRoom() {
  const { t } = useTranslation();
  const { sessionId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { currentUser, token, isAuthenticated } = useAuth();
  const { addMessageListener, removeMessageListener } = useWebSocket();
  
  // Session state
  const [session, setSession] = useState<Session | null>(null);
  const [userStories, setUserStories] = useState<UserStory[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeStory, setActiveStory] = useState<UserStory | null>(null);
  const [completedStories, setCompletedStories] = useState<UserStory[]>([]);
  const [votingScale, setVotingScale] = useState<number[]>([]);
  const [userVote, setUserVote] = useState<number | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [votesRevealed, setVotesRevealed] = useState(false);
  const [finalEstimate, setFinalEstimate] = useState<number | null>(null);
  const [completedVotes, setCompletedVotes] = useState<Record<number, Vote[]>>({});
  const [participantsMap, setParticipantsMap] = useState<Record<string, Participant>>({});
  const [notificationPermission, setNotificationPermission] = useState<string | null>(null);
  
  // Participant info
  const participantId = sessionStorage.getItem("participant_id");
  const participantAlias = sessionStorage.getItem("participant_alias");
  const storedSessionId = sessionStorage.getItem("session_id");
  const storedIsHost = localStorage.getItem(`host_status_${sessionId}`) === "true";
  
  // Check if user is host or participant
  const isHost = (isAuthenticated && !!currentUser) || storedIsHost;
  
  // Notification sound
  const notificationSound = useRef<HTMLAudioElement | null>(null);
  
  // Initialize notification sound
  useEffect(() => {
    notificationSound.current = new Audio("https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=notification-sound-7062.mp3");
  }, []);
  
  // Check notification permission
  useEffect(() => {
    if (window.Notification) {
      setNotificationPermission(Notification.permission);
    }
  }, []);
  
  // Request notification permission
  const requestNotificationPermission = async () => {
    if (window.Notification && Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };
  
  // Join session
  useEffect(() => {
    if (!sessionId) {
      navigate("/");
      return;
    }
    
    // Wait a moment to ensure WebSocket is connecting or ready
    setTimeout(() => {
      if (isHost) {
        if (currentUser && token) {
          console.log("Joining as authenticated host");
          // Join as host and save host status
          hostJoinSession(sessionId, currentUser.id, token);
          localStorage.setItem(`host_status_${sessionId}`, "true");
          localStorage.setItem(`host_userId_${sessionId}`, currentUser.id.toString());
          localStorage.setItem(`host_token_${sessionId}`, token);
        } else if (storedIsHost) {
          console.log("Reconnecting as stored host");
          // Reconnect with stored host status after refresh
          const userId = localStorage.getItem(`host_userId_${sessionId}`);
          const storedToken = localStorage.getItem(`host_token_${sessionId}`);
          
          if (userId && storedToken) {
            // Use stored credentials
            console.log("Using stored credentials for host reconnection");
            hostJoinSession(sessionId, parseInt(userId, 10), storedToken);
          } else {
            // Try to use mock token as a fallback
            console.log("Using fallback mock token for host reconnection");
            hostJoinSession(sessionId, 1, "mock-token-1234");
          }
        }
      } else if (participantId && storedSessionId === sessionId) {
        // Already joined as participant
        console.log("Already joined as participant, no need to rejoin");
      } else {
        // Redirect to join page
        console.log("Not host or participant, redirecting to join page");
        navigate(`/join/${sessionId}`);
      }
    }, 300); // Small delay to ensure WebSocket is connecting
    
    // Cleanup
    return () => {
      closeWebSocketConnection();
    };
  }, [sessionId, isHost, currentUser, token, participantId, storedSessionId]);
  
  // Set up WebSocket listeners
  const { sessionError } = useSessionWebSocket({
    sessionId,
    setSession,
    setUserStories,
    setParticipants,
    setActiveStory,
    setCompletedStories,
    setVotingScale,
    setVotes,
    setVotesRevealed,
    setFinalEstimate,
    setCompletedVotes,
    setParticipantsMap,
    isHost,
  });
  
  // Handle errors
  useEffect(() => {
    if (sessionError) {
      toast({
        title: t("session.error"),
        description: sessionError,
        variant: "destructive",
      });
      navigate("/");
    }
  }, [sessionError, navigate, toast]);
  
  // Set up participant map
  useEffect(() => {
    const map: Record<string, Participant> = {};
    participants.forEach(participant => {
      map[participant.id] = participant;
    });
    setParticipantsMap(map);
  }, [participants]);
  
  // Handle notifications when all participants have voted
  useEffect(() => {
    const handleAllVoted = (data: any) => {
      if (data.notificationsEnabled && isHost) {
        // Play sound
        if (notificationSound.current) {
          notificationSound.current.play().catch(e => console.error("Error playing notification sound:", e));
        }
        
        // Show browser notification
        if (window.Notification && Notification.permission === "granted") {
          new Notification(t("session.allVotedTitle"), {
            body: t("session.allVotedMessage"),
            icon: "/favicon.ico",
          });
        }
        
        // Show toast
        toast({
          title: t("session.allVotedTitle"),
          description: t("session.allVotedMessage"),
        });
      }
    };
    
    addMessageListener("all_voted", handleAllVoted);
    
    return () => {
      removeMessageListener("all_voted", handleAllVoted);
    };
  }, [addMessageListener, removeMessageListener, isHost, toast]);
  
  // Find user vote for active story
  useEffect(() => {
    if (activeStory && participantId) {
      const vote = votes.find(v => 
        v.participantId === participantId && 
        v.userStoryId === activeStory.id
      );
      setUserVote(vote ? vote.value : null);
    } else {
      setUserVote(null);
    }
  }, [activeStory, votes, participantId]);
  
  // Reset votes revealed state when active story changes
  useEffect(() => {
    setVotesRevealed(false);
    setFinalEstimate(null);
  }, [activeStory?.id]);
  
  // Calculate active story index
  const activeStoryIndex = userStories.findIndex(story => story.id === activeStory?.id);
  
  // Handle copy link
  const handleCopyLink = async () => {
    if (!sessionId) return;
    
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
  
  // Handle leave session
  const handleLeaveSession = () => {
    // Clear participant info from storage
    sessionStorage.removeItem("participant_id");
    sessionStorage.removeItem("session_id");
    sessionStorage.removeItem("participant_alias");
    
    // Clear host info from localStorage
    if (sessionId) {
      localStorage.removeItem(`host_status_${sessionId}`);
      localStorage.removeItem(`host_userId_${sessionId}`);
      localStorage.removeItem(`host_token_${sessionId}`);
    }
    
    // Close WebSocket connection
    closeWebSocketConnection();
    
    // Navigate to home or dashboard
    navigate(isHost ? "/dashboard" : "/");
  };
  
  // Handle vote selection
  const handleVoteSelect = (value: number) => {
    setUserVote(value);
  };
  
  // Handle votes reveal
  const handleRevealVotes = () => {
    setVotesRevealed(true);
    
    // Request notification permission if needed
    if (isHost && session?.notificationsEnabled && notificationPermission !== "granted") {
      requestNotificationPermission();
    }
  };
  
  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col">
      <Helmet>
        <title>
          {session?.name ? `${session.name} | ` : ""}
          {t("session.roomPageTitle")} | {t("app.title")}
        </title>
      </Helmet>
      
      <Navbar 
        sessionName={session?.name}
        participantName={isHost ? undefined : participantAlias || undefined}
        onCopyLink={handleCopyLink}
        onLeaveSession={handleLeaveSession}
      />
      
      <div className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {activeStory ? (
            <>
              <UserStoryItem
                sessionId={sessionId || ""}
                userStory={activeStory}
                currentIndex={activeStoryIndex}
                totalStories={userStories.length}
                isHost={isHost}
                votesRevealed={votesRevealed}
                estimatedValue={finalEstimate || undefined}
                onReveal={handleRevealVotes}
              />
              
              {votesRevealed ? (
                <VoteResults
                  votes={votes.filter(v => v.userStoryId === activeStory.id)}
                  participants={participants}
                  finalEstimate={finalEstimate}
                />
              ) : (
                <VotingArea
                  sessionId={sessionId || ""}
                  userStoryId={activeStory.id}
                  votingScale={votingScale}
                  userVote={userVote}
                  isParticipant={!isHost}
                  onVoteSelect={handleVoteSelect}
                  disabled={isHost}
                />
              )}
            </>
          ) : completedStories.length > 0 ? (
            <div className="bg-white rounded-lg shadow-card p-6 mb-6 text-center">
              <h2 className="text-lg font-medium mb-2">{t("session.allStoriesCompleted")}</h2>
              <p className="text-muted-foreground mb-4">{t("session.allStoriesCompletedMessage")}</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-card p-6 mb-6 text-center">
              <h2 className="text-lg font-medium mb-2">{t("session.noActiveStory")}</h2>
              <p className="text-muted-foreground">{t("session.waitingForHost")}</p>
            </div>
          )}
          
          {completedStories.length > 0 && (
            <SessionResults
              completedStories={completedStories}
              votes={completedVotes}
              participants={participantsMap}
            />
          )}
        </div>
        
        {/* Participants List */}
        <div className="lg:col-span-1">
          <ParticipantsList
            participants={participants}
            votes={votes}
            userStoryId={activeStory?.id}
            votesRevealed={votesRevealed}
            isCurrentUser={participantId ? (id) => id === participantId : undefined}
            hostEmail={isHost ? currentUser?.email : null}
          />
        </div>
      </div>
    </div>
  );
}
