import { auth } from '@/app/(auth)/auth';
import {
  deleteChatById,
  getChatById,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '@/lib/errors';

export async function POST(request: Request) {
  let body: PostRequestBody;
  try {
    body = postRequestBodySchema.parse(await request.json());
  } catch {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const { id, message, selectedVisibilityType } = body;

  let chat = await getChatById({ id });
  if (!chat) {
    await saveChat({
      id,
      userId: session.user.id,
      title: (message.parts?.[0] as any)?.text || 'Chat',
      visibility: selectedVisibilityType as VisibilityType,
    });
  }

  await saveMessages({
    messages: [
      {
        id: message.id || generateUUID(),
        chatId: id,
        role: message.role,
        parts: message.parts,
        attachments: message.experimental_attachments ?? [],
        createdAt: new Date(),
      },
    ],
  });

  const backendUrl = process.env.LOCAL_BACKEND_URL;
  if (backendUrl) {
    try {
      await fetch(`${backendUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: id, message }),
      });
    } catch (error) {
      console.error('Failed to call local backend', error);
    }
  }

  return Response.json({ status: 'accepted' }, { status: 202 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');
  const after = searchParams.get('after');

  if (!chatId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id: chatId });
  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const msgs = await getMessagesByChatId({ id: chatId });
  let startIndex = -1;
  if (after) {
    startIndex = msgs.findIndex((m) => m.id === after);
  }
  const next = msgs[startIndex + 1];
  if (!next) {
    return new Response(null, { status: 204 });
  }

  return Response.json(next, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });
  if (!chat || chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });
  return Response.json(deletedChat, { status: 200 });
}
