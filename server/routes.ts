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
  voteSchema 
} from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "planning-poker-secret-key";

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
      let votes = [];
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
      const { sessionId, userId, token } = data;
      
      // Verify token
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
        if (decoded.userId !== userId) {
          throw new Error('Invalid token');
        }
      } catch (error) {
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
    for (const [ws, client] of clients.entries()) {
      if (client.sessionId === sessionId && !excludeClients.includes(ws) && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    }
  }
  
  // Setup REST API routes
  const api = express.Router();
  app.use('/api', api);
  
  // Auth routes
  api.post('/auth/register', async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(409).json({ message: 'Email already in use' });
      }
      
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
      
      // Create user with hashed password
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      
      // Return user data (without password) and token
      res.status(201).json({
        user: {
          id: user.id,
          email: user.email
        },
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({ message: 'Invalid registration data' });
    }
  });
  
  api.post('/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Check password
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      
      // Return user data (without password) and token
      res.json({
        user: {
          id: user.id,
          email: user.email
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({ message: 'Invalid login data' });
    }
  });
  
  // Middleware to verify JWT
  const authenticateJWT = (req: Request, res: Response, next: Function) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      req.body.userId = decoded.userId; // Attach user ID to request
      next();
    } catch (error) {
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
      const { sessionId, alias } = joinSessionSchema.parse({
        ...req.body,
        sessionId: req.params.id
      });
      
      // Check if session exists
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Check if alias is already used in this session
      const existingParticipant = await storage.getParticipantByAlias(sessionId, alias);
      if (existingParticipant) {
        if (existingParticipant.isConnected) {
          return res.status(409).json({ message: 'Alias already in use' });
        } else {
          // If participant exists but is disconnected, update connection status
          await storage.updateParticipantConnection(existingParticipant.id, true);
          
          return res.json({
            participant: existingParticipant,
            sessionId,
            sessionName: session.name
          });
        }
      }
      
      // Create new participant
      const participant = await storage.createParticipant({
        sessionId,
        alias
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
