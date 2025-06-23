import { saveMessages } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const { chatId, message } = body || {};
  if (!chatId || !message) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const secret = process.env.LOCAL_BACKEND_SECRET;
  if (secret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${secret}`) {
      return new ChatSDKError('forbidden:chat').toResponse();
    }
  }

  await saveMessages({
    messages: [
      {
        id: message.id,
        chatId,
        role: message.role,
        parts: message.parts,
        attachments: message.experimental_attachments ?? [],
        createdAt: new Date(),
      },
    ],
  });

  return Response.json({ status: 'ok' }, { status: 200 });
}
