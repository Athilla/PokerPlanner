import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { skipStory, restartVote, revealVotes, moveToNextStory } from "@/lib/websocket";
import { Eye, SkipForward, RefreshCw, Check } from "lucide-react";

export interface UserStory {
  id: number;
  title: string;
  description: string | null;
  finalEstimate: number | null;
  isActive: boolean;
  isCompleted: boolean;
  order: number;
}

interface UserStoryItemProps {
  sessionId: string;
  userStory: UserStory;
  currentIndex: number;
  totalStories: number;
  isHost: boolean;
  votesRevealed: boolean;
  estimatedValue?: number;
  onReveal?: () => void;
}

export default function UserStoryItem({
  sessionId,
  userStory,
  currentIndex,
  totalStories,
  isHost,
  votesRevealed,
  estimatedValue,
  onReveal
}: UserStoryItemProps) {
  const { t } = useTranslation();

  const handleRevealVotes = () => {
    if (onReveal) {
      onReveal();
    }
    revealVotes(sessionId, userStory.id);
  };

  const handleRestartVote = () => {
    restartVote(sessionId, userStory.id);
  };

  const handleSkipStory = () => {
    skipStory(sessionId, userStory.id);
  };

  const handleConfirmEstimation = () => {
    if (estimatedValue !== undefined) {
      moveToNextStory(sessionId, userStory.id, estimatedValue);
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-medium mb-1">{userStory.title}</h2>
            {userStory.description && (
              <p className="text-sm text-muted-foreground">{userStory.description}</p>
            )}
          </div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-sm bg-primary text-white px-2 py-1 rounded-md"
          >
            {currentIndex + 1}/{totalStories}
          </motion.div>
        </div>

        {isHost && !votesRevealed && (
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleRevealVotes}
              className="bg-primary hover:bg-primary/90"
            >
              <Eye className="mr-2 h-4 w-4" />
              {t("session.revealVotes")}
            </Button>
            
            <Button
              onClick={handleRestartVote}
              variant="warning"
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("session.restart")}
            </Button>
            
            <Button
              onClick={handleSkipStory}
              variant="outline"
              className="text-muted-foreground"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              {t("session.skip")}
            </Button>
          </div>
        )}

        {isHost && votesRevealed && estimatedValue !== undefined && (
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleConfirmEstimation}
              className="bg-primary hover:bg-primary/90"
            >
              <Check className="mr-2 h-4 w-4" />
              {t("session.confirmAndContinue")}
            </Button>
            
            <Button
              onClick={handleRestartVote}
              variant="warning"
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("session.restart")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
