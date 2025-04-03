import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useWebSocket } from "@/context/WebSocketContext";
import { safeJSONParse } from "@/lib/utils";

interface UseSessionWebSocketParams {
  sessionId: string | undefined;
  setSession: (session: any) => void;
  setUserStories: (stories: any[]) => void;
  setParticipants: (participants: any[]) => void;
  setActiveStory: (story: any | null) => void;
  setCompletedStories: (stories: any[]) => void;
  setVotingScale: (scale: number[]) => void;
  setVotes: (votes: any[]) => void;
  setVotesRevealed: (revealed: boolean) => void;
  setFinalEstimate: (estimate: number | null) => void;
  setCompletedVotes: (votes: Record<number, any[]>) => void;
  setParticipantsMap: (map: Record<string, any>) => void;
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
      
      // Set completed story votes
      if (data.completedStoryVotes) {
        setCompletedVotes(data.completedStoryVotes);
      }
    };
    
    // Handler for participant joined event
    const handleParticipantJoined = (data: any) => {
      setParticipants(prev => {
        const existingIndex = prev.findIndex(p => p.id === data.participant.id);
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
      setParticipants(prev => 
        prev.map(p => p.id === data.participantId ? { ...p, isConnected: false } : p)
      );
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
      removeMessageListener("participant_voted", handleParticipantVoted);
      removeMessageListener("votes_revealed", handleVotesRevealed);
      removeMessageListener("voting_restarted", handleVotingRestarted);
      removeMessageListener("next_story_activated", handleNextStoryActivated);
      removeMessageListener("story_skipped", handleStorySkipped);
      removeMessageListener("all_stories_completed", handleAllStoriesCompleted);
      removeMessageListener("session_deleted", handleSessionDeleted);
      removeMessageListener("error", handleError);
    };
  }, [sessionId, isHost]);

  return { sessionError };
}
