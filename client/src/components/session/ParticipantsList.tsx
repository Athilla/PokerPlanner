import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { cn, getInitials, getRandomColor } from "@/lib/utils";

export interface Participant {
  id: string;
  alias: string;
  isConnected: boolean;
  joinedAt: string;
}

interface Vote {
  participantId: string;
  userStoryId: number;
  value: number;
}

interface ParticipantsListProps {
  participants: Participant[];
  votes: Vote[];
  userStoryId?: number;
  votesRevealed: boolean;
  isCurrentUser?: (participantId: string) => boolean;
  hostEmail?: string | null;
}

export default function ParticipantsList({
  participants,
  votes,
  userStoryId,
  votesRevealed,
  isCurrentUser,
  hostEmail
}: ParticipantsListProps) {
  const { t } = useTranslation();
  const activeParticipants = participants.filter(p => p.isConnected);

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium mb-4">
          {t("session.participants")} ({activeParticipants.length})
        </h3>
        
        <div className="space-y-3">
          {activeParticipants.map((participant) => {
            const hasVoted = userStoryId 
              ? votes.some(v => v.participantId === participant.id && v.userStoryId === userStoryId)
              : false;
              
            const voteValue = votesRevealed && userStoryId
              ? votes.find(v => v.participantId === participant.id && v.userStoryId === userStoryId)?.value
              : undefined;
              
            return (
              <div 
                key={participant.id}
                className="flex items-center justify-between bg-neutral-100 p-3 rounded-md"
              >
                <div className="flex items-center">
                  <div 
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-white mr-3",
                      getRandomColor(participant.id)
                    )}
                  >
                    <span className="text-sm font-medium">{getInitials(participant.alias)}</span>
                  </div>
                  <span className="font-medium">
                    {participant.alias}
                    {isCurrentUser && isCurrentUser(participant.id) && ` (${t("session.you")})`}
                  </span>
                </div>
                
                {votesRevealed && voteValue !== undefined ? (
                  <div className="bg-white px-3 py-1 rounded-md shadow-sm font-bold">
                    {voteValue}
                  </div>
                ) : (
                  <div 
                    className={cn(
                      "px-2 py-1 rounded text-xs",
                      hasVoted 
                        ? "bg-green-500 text-white" 
                        : "bg-neutral-200 text-muted-foreground"
                    )}
                  >
                    {hasVoted ? t("session.hasVoted") : t("session.waiting")}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hostEmail && (
          <div className="mt-6 p-4 bg-neutral-100 rounded-md">
            <div className="flex items-center mb-2">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="h-4 w-4 mr-2 text-primary"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <h4 className="font-medium">{t("session.sessionHost")}</h4>
            </div>
            <p className="text-sm text-muted-foreground">{hostEmail}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
