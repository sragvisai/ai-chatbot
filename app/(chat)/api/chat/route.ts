import { auth } from '@/app/(auth)/auth';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '@/lib/errors';

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  let body: PostRequestBody;
  try {
    body = postRequestBodySchema.parse(json);
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

  const messageId = message.id || generateUUID();

  await saveMessages({
    messages: [
      {
        id: messageId,
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
      const res = await fetch(`${backendUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: id, message }),
      });
      if (!res.ok) {
        console.error('Local backend responded with', res.status);
        return new Response(null, { status: 500 });
      }
    } catch (error) {
      console.error('Failed to call local backend', error);
      return new Response(null, { status: 500 });
    }
  }

  return Response.json({ status: 'accepted', messageId }, { status: 202 });
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

  const backendUrl = process.env.LOCAL_BACKEND_URL;
  if (backendUrl) {
    try {
      const url = new URL(`${backendUrl}/messages`);
      url.searchParams.set('chatId', chatId);
      if (after) url.searchParams.set('after', after);
      const res = await fetch(url);
      if (res.status === 200) {
        const data = await res.json();
        if (data && data.messageContent && data.messageId) {
          const msg = {
            id: data.messageId,
            role: 'assistant',
            parts: [{ type: 'text', text: data.messageContent }],
            attachments: [],
            createdAt: new Date(),
          };
          await saveMessages({
            messages: [
              { ...msg, chatId },
            ],
          });
          return Response.json(msg, { status: 200 });
        }
      }
    } catch (error) {
      console.error('Failed to poll backend', error);
    }
  }

  return new Response(null, { status: 204 });
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
