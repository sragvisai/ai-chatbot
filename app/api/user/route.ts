import { getUser, createUser } from '@/lib/db/queries';
import { DUMMY_PASSWORD } from '@/lib/constants';

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const email = body?.email;
  if (!email) {
    return new Response(null, { status: 400 });
  }

  let [user] = await getUser(email);
  if (!user) {
    user = await createUser(email, DUMMY_PASSWORD);
  }

  return Response.json({ userId: user.id });
}
