// WebSocket connection helper
let socket: WebSocket | null = null;

// Create a new WebSocket connection
export function createWebSocketConnection(): WebSocket {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return socket;
  }

  // Create WebSocket connection to the server
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  socket = new WebSocket(wsUrl);

  // Handle connection close
  socket.onclose = () => {
    console.log("WebSocket connection closed");
    socket = null;
  };

  return socket;
}

// Get the existing WebSocket connection or create a new one
export function getWebSocket(): WebSocket {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
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

// Generic function to send messages through WebSocket
export function sendMessage(type: string, data: any = {}): void {
  const ws = getWebSocket();
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type,
      ...data
    }));
  } else {
    console.error("WebSocket is not connected");
  }
}

// Join a session as a participant
export function joinSession(sessionId: string, participantId: string): void {
  sendMessage('join_session', { sessionId, participantId });
}

// Join a session as a host
export function hostJoinSession(sessionId: string, userId: number, token: string): void {
  sendMessage('host_join_session', { sessionId, userId, token });
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
