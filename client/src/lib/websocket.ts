// Define a type for pending messages
declare global {
  interface Window {
    pendingMessages?: { type: string; data: any }[];
  }
}

// WebSocket connection helper
let socket: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000;
let reconnectTimeout: number | null = null;

// Create a new WebSocket connection
export function createWebSocketConnection(): WebSocket {
  // Clear any existing reconnect timers
  if (reconnectTimeout) {
    window.clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    return socket;
  }

  // Close existing socket if it's in a closing or connecting state
  if (socket && (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CONNECTING)) {
    socket.onclose = null; // Remove close handler to prevent reconnection
    socket.onerror = null; // Prevent error handler
    socket.close();
  }

  // Create WebSocket connection to the server
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  socket = new WebSocket(wsUrl);

  // Handle connection open
  socket.onopen = () => {
    console.log("WebSocket connection established");
    reconnectAttempts = 0; // Reset reconnect counter on successful connection
  };

  // Handle connection close
  socket.onclose = (event) => {
    console.log("WebSocket connection closed", event.code, event.reason);
    
    // Only try to reconnect if we haven't exceeded maximum attempts and it wasn't a clean close
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && event.code !== 1000) {
      const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
      console.log(`Attempting to reconnect in ${delay}ms...`);
      
      reconnectTimeout = window.setTimeout(() => {
        reconnectAttempts++;
        createWebSocketConnection();
      }, delay);
    } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error("Maximum reconnection attempts reached");
    }
    
    socket = null;
  };

  // Handle connection errors
  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  return socket;
}

// Get the existing WebSocket connection or create a new one
export function getWebSocket(): WebSocket {
  if (!socket || (socket.readyState !== WebSocket.OPEN && socket.readyState !== WebSocket.CONNECTING)) {
    return createWebSocketConnection();
  }
  return socket;
}

// Close the WebSocket connection
export function closeWebSocketConnection(): void {
  if (socket) {
    socket.close();
    socket = null;
  }
}

// Maximum number of attempts to send a message
const MAX_SEND_ATTEMPTS = 5;
const SEND_RETRY_DELAY = 500;

// Generic function to send messages through WebSocket
export function sendMessage(type: string, data: any = {}, attempt: number = 0): void {
  const ws = getWebSocket();
  
  // If the socket is open, send the message immediately
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({
        type,
        ...data
      }));
      console.log(`Message sent successfully: ${type}`);
      return;
    } catch (error) {
      console.error(`Error sending message (${type}):`, error);
      
      // Store the message to retry on next connection
      const pendingMessage = { type, data };
      if (!window.pendingMessages) {
        window.pendingMessages = [];
      }
      window.pendingMessages.push(pendingMessage);
      return;
    }
  }
  
  // If the socket is connecting, wait for it to open
  if (ws.readyState === WebSocket.CONNECTING && attempt < MAX_SEND_ATTEMPTS) {
    console.log(`WebSocket is connecting. Attempt ${attempt + 1}/${MAX_SEND_ATTEMPTS} to send message (${type})...`);
    window.setTimeout(() => {
      sendMessage(type, data, attempt + 1);
    }, SEND_RETRY_DELAY);
    return;
  }
  
  // If we exceed the maximum attempts or socket is closing/closed
  if (attempt >= MAX_SEND_ATTEMPTS || ws.readyState > WebSocket.CONNECTING) {
    console.log(`Queuing message (${type}) for later delivery. WebSocket state: ${ws.readyState}`);
    
    // Store the message to send upon reconnection, if needed
    const pendingMessage = { type, data };
    if (!window.pendingMessages) {
      window.pendingMessages = [];
    }
    window.pendingMessages.push(pendingMessage);
    
    // Force reconnection attempt if socket is closed
    if (ws.readyState === WebSocket.CLOSED) {
      console.log("WebSocket closed, attempting to create a new connection");
      createWebSocketConnection();
    }
  }
}

// Join a session as a participant
export function joinSession(sessionId: string, participantId: string): void {
  sendMessage('join_session', { sessionId, participantId });
}

// Join a session as a host
export function hostJoinSession(sessionId: string, userId: number, token: string): void {
  console.log(`Host joining session: ${sessionId} with userId: ${userId}`);
  sendMessage('host_join_session', { sessionId, userId, token });
  
  // Save host status immediately for resilience
  localStorage.setItem(`host_status_${sessionId}`, "true");
  localStorage.setItem(`host_userId_${sessionId}`, userId.toString());
  localStorage.setItem(`host_token_${sessionId}`, token);
}

// Submit a vote
export function submitVote(sessionId: string, userStoryId: number, value: number): void {
  sendMessage('vote', { sessionId, userStoryId, value });
}

// Host controls
export function revealVotes(sessionId: string, userStoryId: number): void {
  sendMessage('reveal_votes', { sessionId, userStoryId });
}

export function restartVote(sessionId: string, userStoryId: number): void {
  sendMessage('restart_vote', { sessionId, userStoryId });
}

export function skipStory(sessionId: string, userStoryId: number): void {
  sendMessage('skip_story', { sessionId, userStoryId });
}

export function moveToNextStory(sessionId: string, currentStoryId: number, finalEstimate: number): void {
  sendMessage('next_story', { sessionId, currentStoryId, finalEstimate });
}
