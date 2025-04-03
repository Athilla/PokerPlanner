import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { submitVote } from "@/lib/websocket";

interface VotingCardProps {
  value: number;
  sessionId: string;
  userStoryId: number;
  isSelected: boolean;
  disabled: boolean;
  userVote?: number;
  onSelect: (value: number) => void;
}

export default function VotingCard({
  value,
  sessionId,
  userStoryId,
  isSelected,
  disabled,
  userVote,
  onSelect
}: VotingCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Reset flipped state when voting is restarted
  useEffect(() => {
    setIsFlipped(false);
  }, [userStoryId]);

  const handleClick = () => {
    if (disabled) return;
    
    onSelect(value);
    submitVote(sessionId, userStoryId, value);
  };

  return (
    <motion.div
      className="card-container perspective"
      style={{ width: "80px", height: "120px" }}
      whileHover={{ 
        scale: disabled ? 1 : 1.05,
        transition: { duration: 0.2 } 
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className={cn(
          "card w-full h-full relative cursor-pointer",
          isFlipped && "flipped"
        )}
        onClick={handleClick}
        style={{ transformStyle: "preserve-3d", transition: "transform 0.6s" }}
      >
        <div
          className={cn(
            "card-front absolute w-full h-full rounded-lg shadow backface-hidden flex items-center justify-center",
            isSelected 
              ? "bg-primary/10 border-2 border-primary" 
              : "bg-white border-2 border-primary hover:bg-primary/5 transition-colors",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          style={{ backfaceVisibility: "hidden" }}
        >
          <span className="text-2xl font-bold text-primary">{value}</span>
        </div>
        
        <div
          className="card-back absolute w-full h-full bg-primary rounded-lg shadow backface-hidden flex items-center justify-center"
          style={{ 
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)"
          }}
        >
          <span className="text-2xl font-bold text-white">{value}</span>
        </div>
      </div>
    </motion.div>
  );
}
