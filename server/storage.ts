import { v4 as uuidv4 } from "uuid";
import { 
  users, User, InsertUser,
  sessions, Session, InsertSession,
  userStories, UserStory, InsertUserStory,
  participants, Participant, InsertParticipant,
  votes, Vote, InsertVote,
  ParticipantRole
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByFirebaseId(firebaseId: string): Promise<User | undefined>;
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
  getParticipantByUserId(sessionId: string, userId: number): Promise<Participant | undefined>;
  getSessionParticipants(sessionId: string): Promise<Participant[]>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipant(id: string, updates: Partial<Participant>): Promise<Participant | undefined>;
  updateParticipantConnection(id: string, isConnected: boolean): Promise<Participant | undefined>;

  // Votes
  getVote(participantId: string, userStoryId: number): Promise<Vote | undefined>;
  getVotesByUserStory(userStoryId: number): Promise<Vote[]>;
  createOrUpdateVote(vote: InsertVote): Promise<Vote>;
  clearVotesForUserStory(userStoryId: number): Promise<boolean>;
}

import { db } from './db';
import { eq, and, desc, asc } from 'drizzle-orm';

export class DatabaseStorage implements IStorage {
  // ===== User Methods =====
  async getUser(id: number): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return results[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const results = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return results[0];
  }
  
  async getUserByFirebaseId(firebaseId: string): Promise<User | undefined> {
    const results = await db
      .select()
      .from(users)
      .where(eq(users.firebaseId, firebaseId))
      .limit(1);
    return results[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const results = await db
      .insert(users)
      .values({
        email: insertUser.email,
        password: insertUser.password,
        firebaseId: insertUser.firebaseId
      })
      .returning();
    return results[0];
  }

  // ===== Session Methods =====
  async getSession(id: string): Promise<Session | undefined> {
    const results = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    return results[0];
  }

  async getSessionsByHostId(hostId: number): Promise<Session[]> {
    return db
      .select()
      .from(sessions)
      .where(eq(sessions.hostId, hostId))
      .orderBy(desc(sessions.createdAt));
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const results = await db
      .insert(sessions)
      .values({
        name: insertSession.name,
        hostId: insertSession.hostId,
        scale: insertSession.scale,
        notificationsEnabled: insertSession.notificationsEnabled ?? false,
        hostCanVote: insertSession.hostCanVote ?? false,
        allowSpectators: insertSession.allowSpectators ?? true
      })
      .returning();
    return results[0];
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      // First clear votes for all stories in this session
      const userStoriesInSession = await this.getUserStories(id);
      for (const story of userStoriesInSession) {
        await this.clearVotesForUserStory(story.id);
      }
      
      // Then delete all user stories
      await db
        .delete(userStories)
        .where(eq(userStories.sessionId, id));
      
      // Delete all participants
      await db
        .delete(participants)
        .where(eq(participants.sessionId, id));
      
      // Finally delete the session
      const result = await db
        .delete(sessions)
        .where(eq(sessions.id, id));
      
      return result.count > 0;
    } catch (error) {
      console.error("Error deleting session:", error);
      return false;
    }
  }

  // ===== User Story Methods =====
  async getUserStories(sessionId: string): Promise<UserStory[]> {
    return db
      .select()
      .from(userStories)
      .where(eq(userStories.sessionId, sessionId))
      .orderBy(asc(userStories.order));
  }

  async getUserStory(id: number): Promise<UserStory | undefined> {
    const results = await db
      .select()
      .from(userStories)
      .where(eq(userStories.id, id))
      .limit(1);
    return results[0];
  }

  async getActiveUserStory(sessionId: string): Promise<UserStory | undefined> {
    const results = await db
      .select()
      .from(userStories)
      .where(and(
        eq(userStories.sessionId, sessionId),
        eq(userStories.isActive, true)
      ))
      .limit(1);
    return results[0];
  }

  async createUserStory(insertUserStory: InsertUserStory): Promise<UserStory> {
    const results = await db
      .insert(userStories)
      .values({
        sessionId: insertUserStory.sessionId,
        title: insertUserStory.title,
        description: insertUserStory.description,
        order: insertUserStory.order,
        isActive: false,
        isCompleted: false
      })
      .returning();
    return results[0];
  }

  async updateUserStory(id: number, updates: Partial<UserStory>): Promise<UserStory | undefined> {
    const results = await db
      .update(userStories)
      .set(updates)
      .where(eq(userStories.id, id))
      .returning();
    return results[0];
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
    const results = await db
      .select()
      .from(participants)
      .where(eq(participants.id, id))
      .limit(1);
    return results[0];
  }

  async getParticipantByAlias(sessionId: string, alias: string): Promise<Participant | undefined> {
    const results = await db
      .select()
      .from(participants)
      .where(and(
        eq(participants.sessionId, sessionId),
        eq(participants.alias, alias.toLowerCase())
      ))
      .limit(1);
    return results[0];
  }
  
  async getParticipantByUserId(sessionId: string, userId: number): Promise<Participant | undefined> {
    const results = await db
      .select()
      .from(participants)
      .where(and(
        eq(participants.sessionId, sessionId),
        eq(participants.userId, userId)
      ))
      .limit(1);
    return results[0];
  }

  async getSessionParticipants(sessionId: string): Promise<Participant[]> {
    return db
      .select()
      .from(participants)
      .where(eq(participants.sessionId, sessionId));
  }

  async createParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    const results = await db
      .insert(participants)
      .values({
        sessionId: insertParticipant.sessionId,
        alias: insertParticipant.alias,
        role: insertParticipant.role ?? ParticipantRole.VOTER,
        userId: insertParticipant.userId
      })
      .returning();
    return results[0];
  }

  async updateParticipant(id: string, updates: Partial<Participant>): Promise<Participant | undefined> {
    const results = await db
      .update(participants)
      .set(updates)
      .where(eq(participants.id, id))
      .returning();
    return results[0];
  }
  
  async updateParticipantConnection(id: string, isConnected: boolean): Promise<Participant | undefined> {
    return this.updateParticipant(id, { isConnected });
  }

  // ===== Vote Methods =====
  async getVote(participantId: string, userStoryId: number): Promise<Vote | undefined> {
    const results = await db
      .select()
      .from(votes)
      .where(and(
        eq(votes.participantId, participantId),
        eq(votes.userStoryId, userStoryId)
      ))
      .limit(1);
    return results[0];
  }

  async getVotesByUserStory(userStoryId: number): Promise<Vote[]> {
    return db
      .select()
      .from(votes)
      .where(eq(votes.userStoryId, userStoryId));
  }

  async createOrUpdateVote(vote: InsertVote): Promise<Vote> {
    // Check if vote already exists
    const existingVote = await this.getVote(vote.participantId, vote.userStoryId);
    
    if (existingVote) {
      // Update existing vote
      const results = await db
        .update(votes)
        .set({ value: vote.value })
        .where(and(
          eq(votes.participantId, vote.participantId),
          eq(votes.userStoryId, vote.userStoryId)
        ))
        .returning();
      return results[0];
    } else {
      // Create new vote
      const results = await db
        .insert(votes)
        .values({
          participantId: vote.participantId,
          userStoryId: vote.userStoryId,
          value: vote.value
        })
        .returning();
      return results[0];
    }
  }

  async clearVotesForUserStory(userStoryId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(votes)
        .where(eq(votes.userStoryId, userStoryId));
      return result.count > 0;
    } catch (error) {
      console.error("Error clearing votes:", error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();
