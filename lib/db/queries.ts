import 'server-only';

import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type {
  Chat,
  DBMessage,
  Document,
  Suggestion,
  User,
  Vote,
  Stream,
} from './schema';
import type { ArtifactKind } from '@/components/artifact';
import type { VisibilityType } from '@/components/visibility-selector';

// In-memory data stores
const users: User[] = [];
const chats: Chat[] = [];
const messages: DBMessage[] = [];
const votes: Vote[] = [];
const documents: Document[] = [];
const suggestions: Suggestion[] = [];
const streams: Stream[] = [];

export async function getUser(email: string): Promise<Array<User>> {
  return users.filter((u) => u.email === email);
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);
  const newUser: User = {
    id: generateUUID(),
    email,
    password: hashedPassword,
  } as User;
  users.push(newUser);
  return newUser;
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());
  const newUser: User = {
    id: generateUUID(),
    email,
    password,
  } as User;
  users.push(newUser);
  return [{ id: newUser.id, email: newUser.email }];
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  const chat: Chat = {
    id,
    createdAt: new Date(),
    userId,
    title,
    visibility,
  } as Chat;
  chats.push(chat);
  return chat;
}

export async function deleteChatById({ id }: { id: string }) {
  const index = chats.findIndex((c) => c.id === id);
  if (index !== -1) {
    chats.splice(index, 1);
  }
  // remove related messages and streams
  let deleted: Chat | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].chatId === id) messages.splice(i, 1);
  }
  for (let i = streams.length - 1; i >= 0; i--) {
    if (streams[i].chatId === id) streams.splice(i, 1);
  }
  deleted = chats[index];
  return deleted;
}

export async function getChatsByUserId({
  id,
  limit,
}: {
  id: string;
  limit: number;
}) {
  const filtered = chats.filter((c) => c.userId === id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return { chats: filtered.slice(0, limit), hasMore: filtered.length > limit };
}

export async function getChatById({ id }: { id: string }) {
  return chats.find((c) => c.id === id) || null;
}

export async function saveMessages({ messages: newMessages }: { messages: Array<DBMessage> }) {
  newMessages.forEach((m) => messages.push(m));
  return newMessages;
}

export async function getMessagesByChatId({ id }: { id: string }) {
  return messages.filter((m) => m.chatId === id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  const existing = votes.find((v) => v.chatId === chatId && v.messageId === messageId);
  if (existing) {
    existing.isUpvoted = type === 'up';
  } else {
    const vote: Vote = {
      chatId,
      messageId,
      isUpvoted: type === 'up',
    } as Vote;
    votes.push(vote);
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  return votes.filter((v) => v.chatId === id);
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  const doc: Document = {
    id,
    title,
    kind,
    content,
    userId,
    createdAt: new Date(),
  } as Document;
  documents.push(doc);
  return doc;
}

export async function getDocumentsById({ id }: { id: string }) {
  return documents.filter((d) => d.id === id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function getDocumentById({ id }: { id: string }) {
  return (
    documents
      .filter((d) => d.id === id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .at(0) || null
  );
}

export async function deleteDocumentsByIdAfterTimestamp({ id, timestamp }: { id: string; timestamp: Date }) {
  const deleted: Document[] = [];
  for (let i = documents.length - 1; i >= 0; i--) {
    if (documents[i].id === id && documents[i].createdAt > timestamp) {
      deleted.push(documents.splice(i, 1)[0]);
    }
  }
  for (let i = suggestions.length - 1; i >= 0; i--) {
    if (suggestions[i].documentId === id && suggestions[i].documentCreatedAt > timestamp) {
      suggestions.splice(i, 1);
    }
  }
  return deleted;
}

export async function saveSuggestions({ suggestions: suggs }: { suggestions: Array<Suggestion> }) {
  suggs.forEach((s) => suggestions.push(s));
}

export async function getSuggestionsByDocumentId({ documentId }: { documentId: string }) {
  return suggestions.filter((s) => s.documentId === documentId);
}

export async function getMessageById({ id }: { id: string }) {
  return messages.filter((m) => m.id === id);
}

export async function deleteMessagesByChatIdAfterTimestamp({ chatId, timestamp }: { chatId: string; timestamp: Date }) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].chatId === chatId && messages[i].createdAt >= timestamp) {
      const msgId = messages[i].id;
      messages.splice(i, 1);
      for (let j = votes.length - 1; j >= 0; j--) {
        if (votes[j].messageId === msgId && votes[j].chatId === chatId) {
          votes.splice(j, 1);
        }
      }
    }
  }
}

export async function updateChatVisiblityById({ chatId, visibility }: { chatId: string; visibility: 'private' | 'public' }) {
  const chat = chats.find((c) => c.id === chatId);
  if (chat) {
    chat.visibility = visibility;
  }
}

export async function getMessageCountByUserId({ id, differenceInHours }: { id: string; differenceInHours: number }) {
  const cutoff = Date.now() - differenceInHours * 60 * 60 * 1000;
  let count = 0;
  messages.forEach((m) => {
    const chat = chats.find((c) => c.id === m.chatId);
    if (chat && chat.userId === id && m.role === 'user' && m.createdAt.getTime() >= cutoff) {
      count++;
    }
  });
  return count;
}

export async function createStreamId({ streamId, chatId }: { streamId: string; chatId: string }) {
  const s: Stream = { id: streamId, chatId, createdAt: new Date() } as Stream;
  streams.push(s);
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  return streams.filter((s) => s.chatId === chatId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map((s) => s.id);
}
