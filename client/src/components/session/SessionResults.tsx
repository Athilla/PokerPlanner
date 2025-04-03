import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { getInitials, getRandomColor } from "@/lib/utils";

export interface CompletedStory {
  id: number;
  title: string;
  description: string | null;
  finalEstimate: number;
}

interface Vote {
  participantId: string;
  userStoryId: number;
  value: number;
}

interface Participant {
  id: string;
  alias: string;
}

interface SessionResultsProps {
  completedStories: CompletedStory[];
  votes: Record<number, Vote[]>;
  participants: Record<string, Participant>;
}

export default function SessionResults({
  completedStories,
  votes,
  participants
}: SessionResultsProps) {
  const { t } = useTranslation();

  if (completedStories.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium mb-4">{t("session.previousResults")}</h3>
        
        <div className="space-y-4">
          {completedStories.map((story) => {
            const storyVotes = votes[story.id] || [];
            
            return (
              <div key={story.id} className="bg-neutral-100 p-4 rounded-md">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium">{story.title}</h4>
                    {story.description && (
                      <p className="text-sm text-muted-foreground">{story.description}</p>
                    )}
                  </div>
                  <div className="bg-primary text-white px-3 py-1 rounded-md font-bold">
                    {story.finalEstimate}
                  </div>
                </div>
                
                {storyVotes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {storyVotes.map((vote) => {
                      const participant = participants[vote.participantId];
                      if (!participant) return null;
                      
                      return (
                        <div key={vote.participantId} className="bg-white px-2 py-1 rounded shadow-sm text-sm">
                          <span className="font-medium">{participant.alias}</span>: {vote.value}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
