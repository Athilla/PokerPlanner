import { v4 as uuidv4 } from "uuid";
import { 
  users, User, InsertUser,
  sessions, Session, InsertSession,
  userStories, UserStory, InsertUserStory,
  participants, Participant, InsertParticipant,
  votes, Vote, InsertVote
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Sessions
  getSession(id: string): Promise<Session | undefined>;
  getSessionsByHostId(hostId: number): Promise<Session[]>;
  createSession(session: InsertSession): Promise<Session>;
  deleteSession(id: string): Promise<boolean>;

  // User Stories
  getUserStories(sessionId: string): Promise<UserStory[]>;
  getUserStory(id: number): Promise<UserStory | undefined>;
  getActiveUserStory(sessionId: string): Promise<UserStory | undefined>;
  createUserStory(userStory: InsertUserStory): Promise<UserStory>;
  updateUserStory(id: number, updates: Partial<UserStory>): Promise<UserStory | undefined>;
  setActiveUserStory(sessionId: string, userStoryId: number): Promise<UserStory | undefined>;
  markUserStoryCompleted(id: number, finalEstimate: number): Promise<UserStory | undefined>;

  // Participants
  getParticipant(id: string): Promise<Participant | undefined>;
  getParticipantByAlias(sessionId: string, alias: string): Promise<Participant | undefined>;
  getSessionParticipants(sessionId: string): Promise<Participant[]>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipantConnection(id: string, isConnected: boolean): Promise<Participant | undefined>;

  // Votes
  getVote(participantId: string, userStoryId: number): Promise<Vote | undefined>;
  getVotesByUserStory(userStoryId: number): Promise<Vote[]>;
  createOrUpdateVote(vote: InsertVote): Promise<Vote>;
  clearVotesForUserStory(userStoryId: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private sessions: Map<string, Session>;
  private userStories: Map<number, UserStory>;
  private participants: Map<string, Participant>;
  private votes: Map<string, Vote>;
  private userIdCounter: number;
  private userStoryIdCounter: number;
  private voteIdCounter: number;

  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.userStories = new Map();
    this.participants = new Map();
    this.votes = new Map();
    this.userIdCounter = 1;
    this.userStoryIdCounter = 1;
    this.voteIdCounter = 1;
  }

  // ===== User Methods =====
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // ===== Session Methods =====
  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async getSessionsByHostId(hostId: number): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      (session) => session.hostId === hostId
    );
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = uuidv4();
    const createdAt = new Date();
    const session: Session = { ...insertSession, id, createdAt };
    this.sessions.set(id, session);
    return session;
  }

  async deleteSession(id: string): Promise<boolean> {
    // First delete all related entities
    const userStoriesToDelete = Array.from(this.userStories.values())
      .filter(story => story.sessionId === id)
      .map(story => story.id);
    
    for (const storyId of userStoriesToDelete) {
      // Delete all votes for this story
      await this.clearVotesForUserStory(storyId);
      // Delete the story itself
      this.userStories.delete(storyId);
    }
    
    // Delete all participants
    const participantsToDelete = Array.from(this.participants.values())
      .filter(p => p.sessionId === id)
      .map(p => p.id);
    
    for (const pId of participantsToDelete) {
      this.participants.delete(pId);
    }
    
    // Finally delete the session
    return this.sessions.delete(id);
  }

  // ===== User Story Methods =====
  async getUserStories(sessionId: string): Promise<UserStory[]> {
    return Array.from(this.userStories.values())
      .filter(story => story.sessionId === sessionId)
      .sort((a, b) => a.order - b.order);
  }

  async getUserStory(id: number): Promise<UserStory | undefined> {
    return this.userStories.get(id);
  }

  async getActiveUserStory(sessionId: string): Promise<UserStory | undefined> {
    return Array.from(this.userStories.values()).find(
      story => story.sessionId === sessionId && story.isActive
    );
  }

  async createUserStory(insertUserStory: InsertUserStory): Promise<UserStory> {
    const id = this.userStoryIdCounter++;
    const userStory: UserStory = { 
      ...insertUserStory, 
      id, 
      finalEstimate: null, 
      isActive: false, 
      isCompleted: false 
    };
    this.userStories.set(id, userStory);
    return userStory;
  }

  async updateUserStory(id: number, updates: Partial<UserStory>): Promise<UserStory | undefined> {
    const story = await this.getUserStory(id);
    if (!story) return undefined;
    
    const updatedStory = { ...story, ...updates };
    this.userStories.set(id, updatedStory);
    return updatedStory;
  }

  async setActiveUserStory(sessionId: string, userStoryId: number): Promise<UserStory | undefined> {
    // First, deactivate any currently active story
    const currentActive = await this.getActiveUserStory(sessionId);
    if (currentActive && currentActive.id !== userStoryId) {
      await this.updateUserStory(currentActive.id, { isActive: false });
    }
    
    // Then activate the requested story
    return this.updateUserStory(userStoryId, { isActive: true });
  }

  async markUserStoryCompleted(id: number, finalEstimate: number): Promise<UserStory | undefined> {
    return this.updateUserStory(id, { 
      isActive: false, 
      isCompleted: true, 
      finalEstimate 
    });
  }

  // ===== Participant Methods =====
  async getParticipant(id: string): Promise<Participant | undefined> {
    return this.participants.get(id);
  }

  async getParticipantByAlias(sessionId: string, alias: string): Promise<Participant | undefined> {
    return Array.from(this.participants.values()).find(
      p => p.sessionId === sessionId && p.alias.toLowerCase() === alias.toLowerCase()
    );
  }

  async getSessionParticipants(sessionId: string): Promise<Participant[]> {
    return Array.from(this.participants.values())
      .filter(p => p.sessionId === sessionId);
  }

  async createParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    const id = uuidv4();
    const joinedAt = new Date();
    const participant: Participant = { 
      ...insertParticipant, 
      id, 
      isConnected: true, 
      joinedAt 
    };
    this.participants.set(id, participant);
    return participant;
  }

  async updateParticipantConnection(id: string, isConnected: boolean): Promise<Participant | undefined> {
    const participant = await this.getParticipant(id);
    if (!participant) return undefined;
    
    const updatedParticipant = { ...participant, isConnected };
    this.participants.set(id, updatedParticipant);
    return updatedParticipant;
  }

  // ===== Vote Methods =====
  async getVote(participantId: string, userStoryId: number): Promise<Vote | undefined> {
    return Array.from(this.votes.values()).find(
      v => v.participantId === participantId && v.userStoryId === userStoryId
    );
  }

  async getVotesByUserStory(userStoryId: number): Promise<Vote[]> {
    return Array.from(this.votes.values())
      .filter(v => v.userStoryId === userStoryId);
  }

  async createOrUpdateVote(vote: InsertVote): Promise<Vote> {
    // Check if vote already exists
    const existingVote = await this.getVote(vote.participantId, vote.userStoryId);
    
    if (existingVote) {
      // Update existing vote
      const updatedVote = { ...existingVote, value: vote.value };
      this.votes.set(String(existingVote.id), updatedVote);
      return updatedVote;
    } else {
      // Create new vote
      const id = this.voteIdCounter++;
      const newVote: Vote = { ...vote, id };
      this.votes.set(String(id), newVote);
      return newVote;
    }
  }

  async clearVotesForUserStory(userStoryId: number): Promise<boolean> {
    let deleted = false;
    
    for (const [key, vote] of this.votes.entries()) {
      if (vote.userStoryId === userStoryId) {
        this.votes.delete(key);
        deleted = true;
      }
    }
    
    return deleted;
  }
}

export const storage = new MemStorage();
