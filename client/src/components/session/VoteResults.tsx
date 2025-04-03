import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn, getInitials, getRandomColor } from "@/lib/utils";

interface Vote {
  participantId: string;
  userStoryId: number;
  value: number;
}

interface Participant {
  id: string;
  alias: string;
  isConnected: boolean;
}

interface VoteResultsProps {
  votes: Vote[];
  participants: Participant[];
  finalEstimate: number | null;
}

export default function VoteResults({ votes, participants, finalEstimate }: VoteResultsProps) {
  const { t } = useTranslation();
  
  // Only show votes from participants who are still connected
  const activeParticipants = participants.filter(p => p.isConnected);
  const activeVotes = votes.filter(vote => 
    activeParticipants.some(p => p.id === vote.participantId)
  );
  
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">{t("session.votingResult")}</h3>
          {finalEstimate !== null && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="bg-primary text-white px-4 py-2 rounded-md text-xl font-bold"
            >
              {finalEstimate}
            </motion.div>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {activeVotes.length > 0 ? (
            activeVotes.map((vote) => {
              const participant = participants.find(p => p.id === vote.participantId);
              if (!participant) return null;
              
              return (
                <motion.div
                  key={vote.participantId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-neutral-100 p-4 rounded-md flex items-center justify-between"
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
                    <span className="font-medium">{participant.alias}</span>
                  </div>
                  <motion.div
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 10 }}
                    className="bg-white px-3 py-1 rounded-md shadow-sm font-bold"
                  >
                    {vote.value}
                  </motion.div>
                </motion.div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-4 text-muted-foreground">
              {t("session.noVotes")}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
