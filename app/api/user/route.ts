import { getUser, createUser } from '@/lib/db/queries';
import { DUMMY_PASSWORD } from '@/lib/constants';

export async function POST(request: Request) {
  let body: any;
  const backendUrl = process.env.LOCAL_BACKEND_URL;

  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const email = body?.email;
  if (!email) {
    return new Response(null, { status: 400 });
  }
  
  if (backendUrl) {
    try {
      let url = new URL(`${backendUrl}/getUserId`);
      url.searchParams.set('userEmail', email);
      const res = await fetch(url);
      console.log("Whohooo " + JSON.stringify(res));
      if (res.status === 200) {
        const data = await res.json();
        if (data && data.userId && data.userType) {
          return Response.json({ userId: data.userId, userType : data.userType});
        }
      }
    } catch (error) {
      console.error('Failed to poll backend', error);
    }
  }


 
}
