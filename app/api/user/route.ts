
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
        console.log("Success response from the user api " + JSON.stringify(data));
        if (data && data.userId) {
          if (data.userType) {
            return Response.json({ userId: data.userId, userType : data.userType});
          } else {
            return Response.json({userId : data.userId});
          }
        } else {
          return new Response(null, {status : 500});
        }
      } else {
        console.log("Failure response from the user api");
        return new Response(null, {status: 500});
      }
    } catch (error) {
      console.error('Failed to poll backend', error);
    }
  }


 
}
