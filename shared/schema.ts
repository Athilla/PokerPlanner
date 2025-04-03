import { pgTable, text, serial, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define a regex pattern for validating email addresses
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password"),
  firebaseId: text("firebase_id").unique(),
});

export const insertUserSchema = createInsertSchema(users).extend({
  email: z.string().regex(emailRegex, { message: "Invalid email format" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }).optional(),
  firebaseId: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Sessions Table
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  hostId: integer("host_id").notNull().references(() => users.id),
  scale: text("scale").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  notificationsEnabled: boolean("notifications_enabled").default(false),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// User Stories Table
export const userStories = pgTable("user_stories", {
  id: serial("id").primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id),
  title: text("title").notNull(),
  description: text("description"),
  finalEstimate: integer("final_estimate"),
  order: integer("order").notNull(),
  isActive: boolean("is_active").default(false),
  isCompleted: boolean("is_completed").default(false),
});

export const insertUserStorySchema = createInsertSchema(userStories).omit({
  id: true,
  finalEstimate: true,
  isActive: true,
  isCompleted: true,
});

export type InsertUserStory = z.infer<typeof insertUserStorySchema>;
export type UserStory = typeof userStories.$inferSelect;

// Participants Table
export const participants = pgTable("participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id),
  alias: text("alias").notNull(),
  isConnected: boolean("is_connected").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const insertParticipantSchema = createInsertSchema(participants).omit({
  id: true,
  isConnected: true,
  joinedAt: true,
});

export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Participant = typeof participants.$inferSelect;

// Votes Table
export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  participantId: uuid("participant_id").notNull().references(() => participants.id),
  userStoryId: integer("user_story_id").notNull().references(() => userStories.id),
  value: integer("value").notNull(),
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
});

export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;

// Validation schema for joining a session
export const joinSessionSchema = z.object({
  sessionId: z.string().uuid(),
  alias: z.string().min(1, { message: "Alias is required" }).max(50),
});

// Validation schema for voting
export const voteSchema = z.object({
  sessionId: z.string().uuid(),
  userStoryId: z.number().int().positive(),
  participantId: z.string().uuid(),
  value: z.number().int().nonnegative(),
});
