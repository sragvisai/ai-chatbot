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
  let json;
  try {
    json = await request.json();
    console.log("POST Entry call  " + JSON.stringify(json));
  } catch {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  // let body: PostRequestBody;
  // console.log("Body before try");
  // try {
  //   body = postRequestBodySchema.parse(json);
  //   console.log("Body before try " + body);
  // } catch {
  //   console.log("New chatsdk error ");
  //   return new ChatSDKError('bad_request:api').toResponse();
  // }

  const userId: string | undefined = json['userId'];
  if (!userId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  // const { id, message, selectedVisibilityType } = body;

  const id = json['id'];
  const message = json['message']['parts'][0]['text'];
  const selectedVisibilityType = "private";

  let chat = await getChatById({ id });
  console.log("POST call chat - " + JSON.stringify(chat));
  if (!chat) {
    await saveChat({
      id,
      userId,
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
  let returnedMessageId: string | null = null;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/insertUserMessageForMarvin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: id, myStudioSessionId: '1234', userId, message }),
      });
      if (!res.ok) {
        console.error('Local backend responded with', res.status);
        return new Response(null, { status: 500 });
      }
      try {
        const data = await res.json();
        if (data && data.messageId) {
          returnedMessageId = String(data.messageId);
        }
      } catch {
        // ignore JSON parsing errors
      }
    } catch (error) {
      console.error('Failed to call local backend', error);
      return new Response(null, { status: 500 });
    }
  }

  const idForClient = returnedMessageId ?? messageId;
  console.log("Returned Id for client  " + idForClient);

  return Response.json({ status: 'accepted', messageId: idForClient }, { status: 202 });
}

export async function GET(request: Request) {
  console.log("GET Entry point");
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');
  const after = searchParams.get('after');
  const userId = searchParams.get('userId');

  if (!chatId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  if (!userId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const chat = await getChatById({ id: chatId });
  if (!chat) {
    console.log("chat issye");
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== userId) {
    console.log("private issue");
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const backendUrl = process.env.LOCAL_BACKEND_URL;
  console.log("Are you calling this " );
  if (backendUrl) {
    try {
      const url = new URL(`${backendUrl}/getMarvinMessages`);
      url.searchParams.set('chatId', chatId);
      if (after) url.searchParams.set('after', after);
      url.searchParams.set('myStudioSessionId', '1234');
      url.searchParams.set('userId', userId);
      const res = await fetch(url);
      console.log("Whohooo " + JSON.stringify(res));
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
