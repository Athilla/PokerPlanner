import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { getWebSocket, createWebSocketConnection, closeWebSocketConnection } from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";

type MessageHandler = (data: any) => void;

interface WebSocketContextType {
  connected: boolean;
  addMessageListener: (type: string, handler: MessageHandler) => void;
  removeMessageListener: (type: string, handler: MessageHandler) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const { toast } = useToast();
  const messageHandlers = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to WebSocket and set up event listeners
  useEffect(() => {
    const socket = createWebSocketConnection();
    wsRef.current = socket;

    // Handle connection open
    socket.onopen = () => {
      console.log("WebSocket connection opened in context");
      setConnected(true);
      
      // Send any pending messages that were queued during disconnection
      if (window.pendingMessages && window.pendingMessages.length > 0) {
        console.log(`Sending ${window.pendingMessages.length} pending messages`);
        const messagesToSend = [...window.pendingMessages];
        window.pendingMessages = [];
        
        // Send each message with a small delay to ensure proper order
        messagesToSend.forEach((message, index) => {
          setTimeout(() => {
            console.log(`Sending pending message: ${message.type}`);
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({
                type: message.type,
                ...message.data
              }));
            }
          }, index * 100);
        });
      }
    };

    // Handle connection close
    socket.onclose = () => {
      setConnected(false);
    };

    // Handle errors
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to the server. Please try again.",
        variant: "destructive",
      });
    };

    // Handle incoming messages
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type } = data;

        // Handle errors from server
        if (type === "error") {
          toast({
            title: "Error",
            description: data.message || "Something went wrong",
            variant: "destructive",
          });
        }

        // Dispatch message to registered handlers
        if (type && messageHandlers.current.has(type)) {
          const handlers = messageHandlers.current.get(type);
          handlers?.forEach((handler) => {
            try {
              handler(data);
            } catch (err) {
              console.error(`Error in message handler for ${type}:`, err);
            }
          });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    // Cleanup on unmount
    return () => {
      closeWebSocketConnection();
    };
  }, [toast]);

  // Add a message listener
  const addMessageListener = useCallback((type: string, handler: MessageHandler) => {
    if (!messageHandlers.current.has(type)) {
      messageHandlers.current.set(type, new Set());
    }
    messageHandlers.current.get(type)?.add(handler);
  }, []);

  // Remove a message listener
  const removeMessageListener = useCallback((type: string, handler: MessageHandler) => {
    if (messageHandlers.current.has(type)) {
      messageHandlers.current.get(type)?.delete(handler);
    }
  }, []);

  const value = {
    connected,
    addMessageListener,
    removeMessageListener,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
