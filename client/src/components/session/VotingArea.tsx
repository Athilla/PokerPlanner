import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import VotingCard from "@/components/session/VotingCard";

interface VotingAreaProps {
  sessionId: string;
  userStoryId: number;
  votingScale: number[];
  userVote: number | null;
  isParticipant: boolean;
  onVoteSelect: (value: number) => void;
  disabled: boolean;
}

export default function VotingArea({
  sessionId,
  userStoryId,
  votingScale,
  userVote,
  isParticipant,
  onVoteSelect,
  disabled
}: VotingAreaProps) {
  const { t } = useTranslation();
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  
  // Update selected value when user vote changes
  useEffect(() => {
    setSelectedValue(userVote);
  }, [userVote, userStoryId]);
  
  // Handle card selection
  const handleCardSelect = (value: number) => {
    setSelectedValue(value);
    onVoteSelect(value);
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex flex-wrap gap-4 mb-6 justify-center md:justify-start">
          {votingScale.map((value) => (
            <VotingCard
              key={value}
              value={value}
              sessionId={sessionId}
              userStoryId={userStoryId}
              isSelected={selectedValue === value}
              disabled={disabled || !isParticipant}
              userVote={userVote || undefined}
              onSelect={handleCardSelect}
            />
          ))}
        </div>
        
        {isParticipant && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-neutral-100 p-4 rounded-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary mr-2 h-5 w-5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>{t("session.yourSelection")}:</span>
              </div>
              {selectedValue !== null ? (
                <div className="bg-primary text-white px-3 py-1 rounded-md font-bold">
                  {selectedValue}
                </div>
              ) : (
                <div className="text-muted-foreground">
                  {t("session.noSelection")}
                </div>
              )}
            </div>
            <p className="text-sm mt-2 text-muted-foreground">
              {selectedValue !== null 
                ? t("session.waitingForReveal") 
                : t("session.pleaseSelectCard")}
            </p>
          </motion.div>
        )}
        
        {!isParticipant && (
          <div className="bg-neutral-100 p-4 rounded-md">
            <p className="text-center text-muted-foreground">
              {t("session.hostCannotVote")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
