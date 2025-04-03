import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useWebSocket } from "@/context/WebSocketContext";
import { safeJSONParse } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Define needed types for better code quality
interface Participant {
  id: string;
  alias: string;
  sessionId: string;
  role: string;
  userId?: number;
  isConnected: boolean;
}

interface UserStory {
  id: number;
  title: string;
  description: string | null;
  sessionId: string;
  isActive: boolean;
  isCompleted: boolean;
  finalEstimate: number | null;
  order: number;
}

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

interface UseSessionWebSocketParams {
  sessionId: string | undefined;
  setSession: (session: Session) => void;
  setUserStories: (stories: UserStory[]) => void;
  setParticipants: (participants: Participant[]) => void;
  setActiveStory: (story: UserStory | null) => void;
  setCompletedStories: (stories: UserStory[]) => void;
  setVotingScale: (scale: number[]) => void;
  setVotes: (votes: Vote[]) => void;
  setVotesRevealed: (revealed: boolean) => void;
  setFinalEstimate: (estimate: number | null) => void;
  setCompletedVotes: (votes: Record<number, Vote[]>) => void;
  setParticipantsMap: (map: Record<string, Participant>) => void;
  isHost: boolean;
}

export default function useSessionWebSocket({
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
}: UseSessionWebSocketParams) {
  const { t } = useTranslation();
  const { addMessageListener, removeMessageListener } = useWebSocket();
  const [sessionError, setSessionError] = useState<string | null>(null);
  const { toast } = useToast();

  // Update dependencies list to include t and toast
  useEffect(() => {
    if (!sessionId) return;

    // Handler for session joined event (participant)
    const handleSessionJoined = (data: any) => {
      setSession(data.session);
      setUserStories(data.userStories || []);
      setParticipants(data.participants || []);
      
      // Find active story
      const activeStory = data.activeStory || data.userStories?.find((s: any) => s.isActive);
      setActiveStory(activeStory || null);
      
      // Set completed stories
      const completed = data.userStories?.filter((s: any) => s.isCompleted) || [];
      setCompletedStories(completed);
      
      // Set voting scale
      try {
        const scale = typeof data.scale === 'string' 
          ? safeJSONParse(data.scale, [])
          : (data.scale || []);
        setVotingScale(scale);
      } catch (error) {
        console.error("Error parsing voting scale:", error);
        setVotingScale([]);
      }
      
      // Set votes if any are revealed
      if (data.votes && data.votes.length > 0) {
        setVotes(data.votes);
        // If active story is completed, show revealed votes
        if (activeStory?.isCompleted) {
          setVotesRevealed(true);
        }
      }
    };
    
    // Handler for host session joined event
    const handleHostSessionJoined = (data: any) => {
      console.log("Host session joined event received:", data);
      if (!data || !data.session) {
        console.error("Invalid host_session_joined data", data);
        return;
      }
      
      setSession(data.session);
      
      // Check and log user stories
      console.log("User stories received:", data.userStories);
      setUserStories(data.userStories || []);
      setParticipants(data.participants || []);
      
      // Find active story
      const activeStory = data.activeStory || (data.userStories && data.userStories.find((s: any) => s.isActive));
      console.log("Active story determined:", activeStory);
      setActiveStory(activeStory || null);
      
      // Set completed stories
      const completed = data.userStories?.filter((s: any) => s.isCompleted) || [];
      console.log("Completed stories:", completed);
      setCompletedStories(completed);
      
      // Set voting scale
      try {
        const scale = typeof data.scale === 'string' 
          ? safeJSONParse(data.scale, [])
          : (data.scale || []);
        setVotingScale(scale);
      } catch (error) {
        console.error("Error parsing voting scale:", error);
        setVotingScale([]);
      }
      
      // Set completed story votes
      if (data.completedStoryVotes) {
        setCompletedVotes(data.completedStoryVotes);
      }
      
      // Handle active story votes if present
      if (activeStory && data.activeStoryVotes && data.activeStoryVotes.length > 0) {
        setVotes(data.activeStoryVotes);
        setVotesRevealed(data.votesRevealed || false);
        
        // If votes are revealed, calculate final estimate
        if (data.votesRevealed) {
          const voteValues = data.activeStoryVotes.map((v: any) => v.value);
          // Use the server-calculated estimate if available or the active story's finalEstimate
          const estimate = data.finalEstimate || activeStory.finalEstimate || null;
          setFinalEstimate(estimate);
        }
      }
    };
    
    // Handler for participant joined event
    const handleParticipantJoined = (data: any) => {
      setParticipants((prev: Participant[]) => {
        const existingIndex = prev.findIndex((p: Participant) => p.id === data.participant.id);
        if (existingIndex >= 0) {
          // Update existing participant
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...data.participant,
            isConnected: true
          };
          return updated;
        } else {
          // Add new participant
          return [...prev, data.participant];
        }
      });
    };
    
    // Handler for participant disconnected event
    const handleParticipantDisconnected = (data: any) => {
      setParticipants((prev: Participant[]) => 
        prev.map((p: Participant) => p.id === data.participantId ? { ...p, isConnected: false } : p)
      );
    };
    
    // Handler for host disconnected event
    const handleHostDisconnected = () => {
      // Notify the participant that the host has disconnected
      setSessionError(t("session.hostDisconnected"));
    };
    
    // Handler for host reconnected event
    const handleHostReconnected = () => {
      // Clear any host disconnection error and notify that the host is back
      setSessionError(null);
      toast({
        title: t("common.success"),
        description: t("session.hostReconnected")
      });
    };
    
    // Handler for participant voted event
    const handleParticipantVoted = (data: any) => {
      // We just know that someone voted, but not what they voted for
      // The actual vote value is private until revealed
    };
    
    // Handler for votes revealed event
    const handleVotesRevealed = (data: any) => {
      setVotes(data.votes);
      setVotesRevealed(true);
      setFinalEstimate(data.finalEstimate);
    };
    
    // Handler for voting restarted event
    const handleVotingRestarted = (data: any) => {
      setVotes([]);
      setVotesRevealed(false);
      setFinalEstimate(null);
    };
    
    // Handler for next story activated event
    const handleNextStoryActivated = (data: any) => {
      // Update completed story
      setUserStories(prev => 
        prev.map(story => 
          story.id === data.completedStoryId 
            ? { ...story, isActive: false, isCompleted: true, finalEstimate: data.finalEstimate }
            : story.id === data.nextStoryId
              ? { ...story, isActive: true }
              : story
        )
      );
      
      // Set new active story
      setActiveStory(data.nextStory);
      
      // Update completed stories
      setCompletedStories(prev => {
        const completedStory = prev.find(s => s.id === data.completedStoryId);
        if (completedStory) {
          return prev.map(s => 
            s.id === data.completedStoryId 
              ? { ...s, finalEstimate: data.finalEstimate }
              : s
          );
        } else {
          const storyToAdd = {
            id: data.completedStoryId,
            finalEstimate: data.finalEstimate,
            isActive: false,
            isCompleted: true
          };
          return [...prev, storyToAdd];
        }
      });
      
      // Reset voting state
      setVotes([]);
      setVotesRevealed(false);
      setFinalEstimate(null);
    };
    
    // Handler for story skipped event
    const handleStorySkipped = (data: any) => {
      // Update skipped story
      setUserStories(prev => 
        prev.map(story => 
          story.id === data.previousStoryId 
            ? { ...story, isActive: false }
            : story.id === data.nextStoryId
              ? { ...story, isActive: true }
              : story
        )
      );
      
      // Set new active story
      setActiveStory(data.nextStory);
      
      // Reset voting state
      setVotes([]);
      setVotesRevealed(false);
      setFinalEstimate(null);
    };
    
    // Handler for all stories completed event
    const handleAllStoriesCompleted = (data: any) => {
      // Update last story
      if (data.lastCompletedId) {
        setUserStories(prev => 
          prev.map(story => 
            story.id === data.lastCompletedId 
              ? { ...story, isActive: false, isCompleted: true, finalEstimate: data.finalEstimate }
              : story
          )
        );
        
        // Update completed stories
        setCompletedStories(prev => {
          const completedStory = prev.find(s => s.id === data.lastCompletedId);
          if (completedStory) {
            return prev.map(s => 
              s.id === data.lastCompletedId 
                ? { ...s, finalEstimate: data.finalEstimate }
                : s
            );
          } else {
            const storyToAdd = {
              id: data.lastCompletedId,
              finalEstimate: data.finalEstimate,
              isActive: false,
              isCompleted: true
            };
            return [...prev, storyToAdd];
          }
        });
      } else if (data.lastSkippedId) {
        setUserStories(prev => 
          prev.map(story => 
            story.id === data.lastSkippedId 
              ? { ...story, isActive: false }
              : story
          )
        );
      }
      
      // No more active stories
      setActiveStory(null);
      
      // Reset voting state
      setVotes([]);
      setVotesRevealed(false);
      setFinalEstimate(null);
    };
    
    // Handler for session deleted event
    const handleSessionDeleted = () => {
      setSessionError(t("session.sessionDeleted"));
    };
    
    // Handler for error event
    const handleError = (data: any) => {
      console.error("WebSocket error:", data.message);
      setSessionError(data.message || t("session.unknownError"));
    };
    
    // Register handlers
    if (isHost) {
      addMessageListener("host_session_joined", handleHostSessionJoined);
    } else {
      addMessageListener("session_joined", handleSessionJoined);
    }
    addMessageListener("participant_joined", handleParticipantJoined);
    addMessageListener("participant_disconnected", handleParticipantDisconnected);
    addMessageListener("host_disconnected", handleHostDisconnected);
    addMessageListener("host_reconnected", handleHostReconnected);
    addMessageListener("participant_voted", handleParticipantVoted);
    addMessageListener("votes_revealed", handleVotesRevealed);
    addMessageListener("voting_restarted", handleVotingRestarted);
    addMessageListener("next_story_activated", handleNextStoryActivated);
    addMessageListener("story_skipped", handleStorySkipped);
    addMessageListener("all_stories_completed", handleAllStoriesCompleted);
    addMessageListener("session_deleted", handleSessionDeleted);
    addMessageListener("error", handleError);
    
    // Cleanup
    return () => {
      if (isHost) {
        removeMessageListener("host_session_joined", handleHostSessionJoined);
      } else {
        removeMessageListener("session_joined", handleSessionJoined);
      }
      removeMessageListener("participant_joined", handleParticipantJoined);
      removeMessageListener("participant_disconnected", handleParticipantDisconnected);
      removeMessageListener("host_disconnected", handleHostDisconnected);
      removeMessageListener("host_reconnected", handleHostReconnected);
      removeMessageListener("participant_voted", handleParticipantVoted);
      removeMessageListener("votes_revealed", handleVotesRevealed);
      removeMessageListener("voting_restarted", handleVotingRestarted);
      removeMessageListener("next_story_activated", handleNextStoryActivated);
      removeMessageListener("story_skipped", handleStorySkipped);
      removeMessageListener("all_stories_completed", handleAllStoriesCompleted);
      removeMessageListener("session_deleted", handleSessionDeleted);
      removeMessageListener("error", handleError);
    };
  }, [sessionId, isHost, addMessageListener, removeMessageListener, t, toast, setSession, setUserStories, setParticipants, setActiveStory, setCompletedStories, setVotingScale, setVotes, setVotesRevealed, setFinalEstimate, setCompletedVotes]);

  return { sessionError };
}
