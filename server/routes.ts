import express, { Request, Response } from "express";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertSessionSchema, 
  insertUserStorySchema, 
  joinSessionSchema, 
  voteSchema,
  Vote,
  ParticipantRole
} from "@shared/schema";
import { auth } from "./firebase-admin";
import { NextFunction } from "express";

// Utility to get Fibonacci sequence
function generateFibonacciScale(): number[] {
  return [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
}

// Calculate the final estimate (average rounded up to next value in scale)
function calculateFinalEstimate(values: number[], scale: number[]): number {
  if (values.length === 0) return 0;
  
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  // Find the next highest value in the scale
  for (const value of scale) {
    if (value >= avg) {
      return value;
    }
  }
  
  // If no higher value found, return the highest in the scale
  return scale[scale.length - 1];
}

// WebSocket types
interface WSClient {
  ws: WebSocket;
  sessionId?: string;
  participantId?: string;
  isHost?: boolean;
  userId?: number;
}

type WSMessage = {
  type: string;
  [key: string]: any;
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store active WebSocket connections
  const clients = new Map<WebSocket, WSClient>();
  
  // Handle WebSocket connections
  wss.on('connection', (ws: WebSocket) => {
    // Initialize client
    const client: WSClient = { ws };
    clients.set(ws, client);
    
    // Handle messages
    ws.on('message', async (message: string) => {
      try {
        const data: WSMessage = JSON.parse(message);
        
        switch (data.type) {
          case 'join_session':
            await handleJoinSession(client, data);
            break;
          case 'host_join_session':
            await handleHostJoinSession(client, data);
            break;
          case 'vote':
            await handleVote(client, data);
            break;
          case 'reveal_votes':
            await handleRevealVotes(client, data);
            break;
          case 'restart_vote':
            await handleRestartVote(client, data);
            break;
          case 'skip_story':
            await handleSkipStory(client, data);
            break;
          case 'next_story':
            await handleNextStory(client, data);
            break;
          default:
            sendToClient(client, {
              type: 'error',
              message: 'Unknown message type'
            });
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
        sendToClient(client, {
          type: 'error',
          message: 'Failed to process message'
        });
      }
    });
    
    // Handle disconnections
    ws.on('close', async () => {
      const client = clients.get(ws);
      if (client?.participantId) {
        await storage.updateParticipantConnection(client.participantId, false);
        broadcastToSession(client.sessionId!, {
          type: 'participant_disconnected',
          participantId: client.participantId
        });
      }
      clients.delete(ws);
    });
  });
  
  // WebSocket helper functions
  async function handleJoinSession(client: WSClient, data: WSMessage) {
    try {
      const { sessionId, participantId } = data;
      
      // Validate session exists
      const session = await storage.getSession(sessionId);
      if (!session) {
        return sendToClient(client, {
          type: 'error',
          message: 'Session not found'
        });
      }
      
      // Set client session info
      client.sessionId = sessionId;
      client.participantId = participantId;
      
      // Get participant details
      const participant = await storage.getParticipant(participantId);
      if (!participant) {
        return sendToClient(client, {
          type: 'error',
          message: 'Participant not found'
        });
      }
      
      // Update participant connection status
      await storage.updateParticipantConnection(participantId, true);
      
      // Get session data
      const userStories = await storage.getUserStories(sessionId);
      const participants = await storage.getSessionParticipants(sessionId);
      const activeStory = userStories.find(story => story.isActive);
      
      // Get votes if there's an active story
      let votes: Vote[] = [];
      if (activeStory) {
        votes = await storage.getVotesByUserStory(activeStory.id);
      }
      
      // Get scale
      const scale = session.scale ? JSON.parse(session.scale) : generateFibonacciScale();
      
      // Send session data to the client
      sendToClient(client, {
        type: 'session_joined',
        session,
        userStories,
        participants,
        activeStory,
        votes: activeStory?.isCompleted ? votes : [], // Only send votes if story is completed
        scale,
        notificationsEnabled: session.notificationsEnabled
      });
      
      // Broadcast to other clients in the session
      broadcastToSession(sessionId, {
        type: 'participant_joined',
        participant
      }, [client.ws]);
    } catch (error) {
      console.error('Error handling join session:', error);
      sendToClient(client, {
        type: 'error',
        message: 'Failed to join session'
      });
    }
  }
  
  async function handleHostJoinSession(client: WSClient, data: WSMessage) {
    try {
      const { sessionId, token } = data;
      let { userId } = data;
      
      // Verify token (Firebase or Development)
      try {
        if (!token) {
          throw new Error('No token provided');
        }
        
        // Check if this is a development token
        if (DEV_MODE && (token.startsWith('mock-token-') || token.startsWith('mock-id-token-') || token.startsWith('dev-token-'))) {
          console.log('DEV MODE: Host joining session with development token');
          
          // Find the dev user (should have been created during verify-token)
          let user = await storage.getUserByFirebaseId('dev-firebase-id');
          
          if (!user) {
            console.log('DEV MODE: No dev user found, creating one');
            user = await storage.createUser({
              email: 'dev@example.com',
              firebaseId: 'dev-firebase-id'
            });
          }
          
          // In dev mode, we can just override userId with the dev user id for consistency
          // This ensures the user can access their sessions
          userId = user.id;
          
          // We successfully validated in dev mode, continue with the request
          console.log('DEV MODE: Authentication successful with development token');
        } else {
          // Regular Firebase token verification
          const decodedToken = await auth.verifyIdToken(token);
          const firebaseUid = decodedToken.uid;
          
          // Get the user from our database
          const user = await storage.getUserByFirebaseId(firebaseUid);
          
          if (!user || user.id !== userId) {
            throw new Error('Invalid token or user ID mismatch');
          }
        }
      } catch (error) {
        console.error('Authentication error:', error);
        return sendToClient(client, {
          type: 'error',
          message: 'Authentication failed'
        });
      }
      
      // Validate session exists and belongs to the host
      const session = await storage.getSession(sessionId);
      if (!session) {
        return sendToClient(client, {
          type: 'error',
          message: 'Session not found'
        });
      }
      
      if (session.hostId !== userId) {
        return sendToClient(client, {
          type: 'error',
          message: 'You are not the host of this session'
        });
      }
      
      // Set client session info
      client.sessionId = sessionId;
      client.userId = userId;
      client.isHost = true;
      
      // Get session data
      const userStories = await storage.getUserStories(sessionId);
      const participants = await storage.getSessionParticipants(sessionId);
      const activeStory = userStories.find(story => story.isActive);
      
      // Get all votes for completed stories
      const completedStoryVotes = new Map<number, any[]>();
      for (const story of userStories.filter(s => s.isCompleted)) {
        completedStoryVotes.set(story.id, await storage.getVotesByUserStory(story.id));
      }
      
      // Get scale
      const scale = session.scale ? JSON.parse(session.scale) : generateFibonacciScale();
      
      // Send session data to the client
      sendToClient(client, {
        type: 'host_session_joined',
        session,
        userStories,
        participants,
        activeStory,
        completedStoryVotes: Object.fromEntries(completedStoryVotes),
        scale,
        notificationsEnabled: session.notificationsEnabled
      });
      
      // Broadcast host connected
      broadcastToSession(sessionId, {
        type: 'host_connected'
      }, [client.ws]);
    } catch (error) {
      console.error('Error handling host join session:', error);
      sendToClient(client, {
        type: 'error',
        message: 'Failed to join session as host'
      });
    }
  }
  
  async function handleVote(client: WSClient, data: WSMessage) {
    try {
      const { sessionId, userStoryId, value } = data;
      
      if (!client.participantId || client.sessionId !== sessionId) {
        return sendToClient(client, {
          type: 'error',
          message: 'Not authorized to vote in this session'
        });
      }
      
      // Get the user story
      const userStory = await storage.getUserStory(userStoryId);
      if (!userStory || userStory.sessionId !== sessionId || !userStory.isActive || userStory.isCompleted) {
        return sendToClient(client, {
          type: 'error',
          message: 'Cannot vote on this story'
        });
      }
      
      // Record the vote
      const vote = await storage.createOrUpdateVote({
        participantId: client.participantId,
        userStoryId,
        value
      });
      
      // Send confirmation to the voter
      sendToClient(client, {
        type: 'vote_recorded',
        userStoryId,
        value
      });
      
      // Broadcast to session that a vote was cast (without the value)
      broadcastToSession(sessionId, {
        type: 'participant_voted',
        participantId: client.participantId,
        userStoryId
      });
      
      // Check if all participants have voted
      const participants = await storage.getSessionParticipants(sessionId);
      const activeParticipants = participants.filter(p => p.isConnected);
      const votes = await storage.getVotesByUserStory(userStoryId);
      
      const allVoted = activeParticipants.every(p => 
        votes.some(v => v.participantId === p.id)
      );
      
      if (allVoted && activeParticipants.length > 0) {
        // Get session to check if notifications are enabled
        const session = await storage.getSession(sessionId);
        
        // Broadcast that all have voted
        broadcastToSession(sessionId, {
          type: 'all_voted',
          userStoryId,
          notificationsEnabled: session?.notificationsEnabled || false
        });
      }
    } catch (error) {
      console.error('Error handling vote:', error);
      sendToClient(client, {
        type: 'error',
        message: 'Failed to record vote'
      });
    }
  }
  
  async function handleRevealVotes(client: WSClient, data: WSMessage) {
    try {
      const { sessionId, userStoryId } = data;
      
      // Ensure client is the host
      if (!client.isHost || client.sessionId !== sessionId) {
        return sendToClient(client, {
          type: 'error',
          message: 'Only the host can reveal votes'
        });
      }
      
      // Get the user story
      const userStory = await storage.getUserStory(userStoryId);
      if (!userStory || userStory.sessionId !== sessionId || !userStory.isActive) {
        return sendToClient(client, {
          type: 'error',
          message: 'Cannot reveal votes for this story'
        });
      }
      
      // Get all votes for this story
      const votes = await storage.getVotesByUserStory(userStoryId);
      
      // Get participants
      const participants = await storage.getSessionParticipants(sessionId);
      
      // Get the voting scale
      const session = await storage.getSession(sessionId);
      const scale = session?.scale ? JSON.parse(session.scale) : generateFibonacciScale();
      
      // Calculate the final estimate
      const voteValues = votes.map(v => v.value);
      const finalEstimate = calculateFinalEstimate(voteValues, scale);
      
      // Broadcast votes to all session participants
      broadcastToSession(sessionId, {
        type: 'votes_revealed',
        userStoryId,
        votes,
        participants,
        finalEstimate
      });
    } catch (error) {
      console.error('Error handling reveal votes:', error);
      sendToClient(client, {
        type: 'error',
        message: 'Failed to reveal votes'
      });
    }
  }
  
  async function handleRestartVote(client: WSClient, data: WSMessage) {
    try {
      const { sessionId, userStoryId } = data;
      
      // Ensure client is the host
      if (!client.isHost || client.sessionId !== sessionId) {
        return sendToClient(client, {
          type: 'error',
          message: 'Only the host can restart voting'
        });
      }
      
      // Get the user story
      const userStory = await storage.getUserStory(userStoryId);
      if (!userStory || userStory.sessionId !== sessionId || !userStory.isActive) {
        return sendToClient(client, {
          type: 'error',
          message: 'Cannot restart voting for this story'
        });
      }
      
      // Clear all votes for this story
      await storage.clearVotesForUserStory(userStoryId);
      
      // Broadcast restart to all session participants
      broadcastToSession(sessionId, {
        type: 'voting_restarted',
        userStoryId
      });
    } catch (error) {
      console.error('Error handling restart vote:', error);
      sendToClient(client, {
        type: 'error',
        message: 'Failed to restart voting'
      });
    }
  }
  
  async function handleSkipStory(client: WSClient, data: WSMessage) {
    try {
      const { sessionId, userStoryId } = data;
      
      // Ensure client is the host
      if (!client.isHost || client.sessionId !== sessionId) {
        return sendToClient(client, {
          type: 'error',
          message: 'Only the host can skip stories'
        });
      }
      
      // Get the user story
      const userStory = await storage.getUserStory(userStoryId);
      if (!userStory || userStory.sessionId !== sessionId || !userStory.isActive) {
        return sendToClient(client, {
          type: 'error',
          message: 'Cannot skip this story'
        });
      }
      
      // Deactivate the current story without completing it
      await storage.updateUserStory(userStoryId, { isActive: false });
      
      // Find the next story
      const allStories = await storage.getUserStories(sessionId);
      const currentIndex = allStories.findIndex(s => s.id === userStoryId);
      const nextStories = allStories.slice(currentIndex + 1)
        .filter(s => !s.isCompleted);
      
      if (nextStories.length > 0) {
        // Activate the next story
        const nextStory = nextStories[0];
        await storage.setActiveUserStory(sessionId, nextStory.id);
        
        // Clear votes for the next story (just in case)
        await storage.clearVotesForUserStory(nextStory.id);
        
        // Broadcast story transition
        broadcastToSession(sessionId, {
          type: 'story_skipped',
          previousStoryId: userStoryId,
          nextStoryId: nextStory.id,
          nextStory
        });
      } else {
        // No more stories
        broadcastToSession(sessionId, {
          type: 'all_stories_completed',
          lastSkippedId: userStoryId
        });
      }
    } catch (error) {
      console.error('Error handling skip story:', error);
      sendToClient(client, {
        type: 'error',
        message: 'Failed to skip story'
      });
    }
  }
  
  async function handleNextStory(client: WSClient, data: WSMessage) {
    try {
      const { sessionId, currentStoryId, finalEstimate } = data;
      
      // Ensure client is the host
      if (!client.isHost || client.sessionId !== sessionId) {
        return sendToClient(client, {
          type: 'error',
          message: 'Only the host can move to the next story'
        });
      }
      
      // Complete the current story with the final estimate
      await storage.markUserStoryCompleted(currentStoryId, finalEstimate);
      
      // Find the next story
      const allStories = await storage.getUserStories(sessionId);
      const currentIndex = allStories.findIndex(s => s.id === currentStoryId);
      const nextStories = allStories.slice(currentIndex + 1)
        .filter(s => !s.isCompleted);
      
      if (nextStories.length > 0) {
        // Activate the next story
        const nextStory = nextStories[0];
        await storage.setActiveUserStory(sessionId, nextStory.id);
        
        // Clear votes for the next story (just in case)
        await storage.clearVotesForUserStory(nextStory.id);
        
        // Broadcast story transition
        broadcastToSession(sessionId, {
          type: 'next_story_activated',
          completedStoryId: currentStoryId,
          nextStoryId: nextStory.id,
          nextStory,
          finalEstimate
        });
      } else {
        // No more stories
        broadcastToSession(sessionId, {
          type: 'all_stories_completed',
          lastCompletedId: currentStoryId,
          finalEstimate
        });
      }
    } catch (error) {
      console.error('Error handling next story:', error);
      sendToClient(client, {
        type: 'error',
        message: 'Failed to move to next story'
      });
    }
  }
  
  function sendToClient(client: WSClient, data: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }
  
  function broadcastToSession(sessionId: string, data: any, excludeClients: WebSocket[] = []) {
    // Use Array.from to avoid iterator issues
    const entries = Array.from(clients.entries());
    for (const [ws, client] of entries) {
      if (client.sessionId === sessionId && !excludeClients.includes(ws) && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    }
  }
  
  // Setup REST API routes
  const api = express.Router();
  app.use('/api', api);
  
  // Development mode flag
  const DEV_MODE = true; // Set to false in production
  
  // Firebase Auth routes
  api.post('/auth/verify-token', async (req: Request, res: Response) => {
    try {
      const { idToken } = req.body;
      
      if (!idToken) {
        return res.status(400).json({ message: 'No token provided' });
      }
      
      // Check if this is a development token
      if (DEV_MODE && (idToken.startsWith('mock-token-') || idToken.startsWith('mock-id-token-'))) {
        console.log('DEV MODE: Processing development token');
        
        // Extract email from token or use a default
        const email = req.body.email || 'dev@example.com';
        
        // Find or create dev user
        let user = await storage.getUserByEmail(email);
        
        if (!user) {
          console.log('DEV MODE: Creating development user');
          user = await storage.createUser({
            email,
            firebaseId: 'dev-firebase-id'
          });
        }
        
        // Return user data and the dev token
        return res.json({
          user: {
            id: user.id,
            email: user.email
          },
          token: idToken
        });
      }
      
      // Regular Firebase token verification
      const decodedToken = await auth.verifyIdToken(idToken);
      const firebaseUid = decodedToken.uid;
      const email = decodedToken.email || '';
      
      // Find or create user in our database
      let user = await storage.getUserByFirebaseId(firebaseUid);
      
      if (!user) {
        // Create a new user record in our database
        user = await storage.createUser({
          email,
          firebaseId: firebaseUid
        });
      }
      
      // Return user data and the verified token
      res.json({
        user: {
          id: user.id,
          email: user.email
        },
        token: idToken
      });
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({ message: 'Invalid or expired token' });
    }
  });
  
  // Middleware to verify JWT
  const authenticateJWT = async (req: Request, res: Response, next: Function) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Check if this is a development token
    if (DEV_MODE && (token.startsWith('mock-token-') || token.startsWith('mock-id-token-') || token.startsWith('dev-token-'))) {
      console.log('DEV MODE: Authenticating with development token');
      
      try {
        // Find the dev user (should have been created during verify-token)
        let user = await storage.getUserByFirebaseId('dev-firebase-id');
        
        if (!user) {
          // If no dev user exists, create one
          console.log('DEV MODE: Creating development user for authentication');
          user = await storage.createUser({
            email: 'dev@example.com',
            firebaseId: 'dev-firebase-id'
          });
        }
        
        req.body.userId = user.id; // Attach user ID to request
        return next(); // Important: return here to skip Firebase verification
      } catch (error) {
        console.error('DEV MODE authentication error:', error);
        return res.status(500).json({ message: 'Development mode authentication error' });
      }
    }
    
    // Only get here if not in dev mode or not a dev token
    if (DEV_MODE) {
      // If we're in dev mode and got here, the token might be invalid or malformed
      // Let's be more permissive and try to continue with a default user
      console.log('DEV MODE: Using fallback authentication - token was not recognized as a development token');
      try {
        // Try to get or create a default user
        let user = await storage.getUserByFirebaseId('dev-firebase-id');
        if (!user) {
          user = await storage.createUser({
            email: 'dev@example.com',
            firebaseId: 'dev-firebase-id'
          });
        }
        
        req.body.userId = user.id;
        return next();
      } catch (fallbackError) {
        console.error('DEV MODE fallback authentication error:', fallbackError);
        return res.status(500).json({ message: 'Development fallback authentication failed' });
      }
    }
    
    // Production mode or explicitly trying to use Firebase auth in dev mode
    try {
      // Regular Firebase token verification
      const decodedToken = await auth.verifyIdToken(token);
      const uid = decodedToken.uid;
      
      // Get or create the user in our database
      let user = await storage.getUserByFirebaseId(uid);
      
      if (!user) {
        // If the user doesn't exist in our database but has a valid Firebase token,
        // we should create a user record in our database
        const email = decodedToken.email || '';
        user = await storage.createUser({
          email,
          firebaseId: uid
        });
      }
      
      req.body.userId = user.id; // Attach user ID to request
      return next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
  };
  
  // Session routes
  api.post('/sessions', authenticateJWT, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      
      // Validate session data
      const sessionData = insertSessionSchema.parse({
        ...req.body,
        hostId: userId
      });
      
      // Create session
      const session = await storage.createSession(sessionData);
      
      // Create user stories if provided
      if (req.body.userStories && Array.isArray(req.body.userStories)) {
        for (const [index, story] of req.body.userStories.entries()) {
          await storage.createUserStory({
            sessionId: session.id,
            title: story.title,
            description: story.description || null,
            order: index
          });
        }
      }
      
      // If userStories were created, activate the first one
      const userStories = await storage.getUserStories(session.id);
      if (userStories.length > 0) {
        await storage.setActiveUserStory(session.id, userStories[0].id);
      }
      
      res.status(201).json({ session });
    } catch (error) {
      console.error('Create session error:', error);
      res.status(400).json({ message: 'Invalid session data' });
    }
  });
  
  api.get('/sessions', authenticateJWT, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      
      // Get all sessions for the host
      const sessions = await storage.getSessionsByHostId(userId);
      
      // For each session, get the number of user stories
      const sessionsWithCounts = await Promise.all(sessions.map(async (session) => {
        const userStories = await storage.getUserStories(session.id);
        return {
          ...session,
          storiesCount: userStories.length
        };
      }));
      
      res.json({ sessions: sessionsWithCounts });
    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({ message: 'Failed to retrieve sessions' });
    }
  });
  
  api.get('/sessions/:id', authenticateJWT, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      const { id } = req.params;
      
      // Get the session
      const session = await storage.getSession(id);
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Check if user is the host
      if (session.hostId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Get user stories for this session
      const userStories = await storage.getUserStories(id);
      
      // Get participants
      const participants = await storage.getSessionParticipants(id);
      
      res.json({ session, userStories, participants });
    } catch (error) {
      console.error('Get session error:', error);
      res.status(500).json({ message: 'Failed to retrieve session' });
    }
  });
  
  api.delete('/sessions/:id', authenticateJWT, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      const { id } = req.params;
      
      // Get the session
      const session = await storage.getSession(id);
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Check if user is the host
      if (session.hostId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Delete the session (and all related entities)
      await storage.deleteSession(id);
      
      // Notify any connected clients
      broadcastToSession(id, {
        type: 'session_deleted'
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete session error:', error);
      res.status(500).json({ message: 'Failed to delete session' });
    }
  });
  
  // Participant routes
  api.post('/sessions/:id/join', async (req: Request, res: Response) => {
    try {
      // Validate join request
      const { sessionId, alias, role } = joinSessionSchema.parse({
        ...req.body,
        sessionId: req.params.id
      });
      
      // Check if session exists
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Verify role is allowed for this session
      if (role === ParticipantRole.SPECTATOR && !session.allowSpectators) {
        return res.status(403).json({ message: 'Spectators are not allowed in this session' });
      }
      
      // Check if alias is already used in this session
      const existingParticipant = await storage.getParticipantByAlias(sessionId, alias);
      if (existingParticipant) {
        if (existingParticipant.isConnected) {
          return res.status(409).json({ message: 'Alias already in use' });
        } else {
          // If participant exists but is disconnected, update connection status and role
          await storage.updateParticipant(existingParticipant.id, { 
            isConnected: true,
            role
          });
          
          const updatedParticipant = await storage.getParticipant(existingParticipant.id);
          
          return res.json({
            participant: updatedParticipant,
            sessionId,
            sessionName: session.name
          });
        }
      }
      
      // Create new participant
      const participant = await storage.createParticipant({
        sessionId,
        alias,
        role
      });
      
      res.status(201).json({
        participant,
        sessionId,
        sessionName: session.name
      });
    } catch (error) {
      console.error('Join session error:', error);
      res.status(400).json({ message: 'Invalid join request' });
    }
  });
  
  // Check session exists (for join page)
  api.get('/sessions/:id/check', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Check if session exists
      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      res.json({
        exists: true,
        sessionName: session.name
      });
    } catch (error) {
      console.error('Check session error:', error);
      res.status(500).json({ message: 'Failed to check session' });
    }
  });
  
  return httpServer;
}
