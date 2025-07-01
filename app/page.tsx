'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/toast';

export default function Page() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    console.log("handleSubmit - + page.tsx");
    e.preventDefault();
    try {
      console.log("page.tsx - making an api call");
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      console.log("page.tsx user api response " + JSON.stringify(res));
      if (res.ok) {
        const data = await res.json();
        const userId = data.userId;
        const userType = data.userType;
        console.log("page.tsx - Got the response from the user api " + JSON.stringify(data));
        console.log(`Response from the user api - ${userId} - ${userType}`);
        if (userId && userId !== '-1') {
          document.cookie = `userId=${userId};userType=${userType}; path=/`;
          localStorage.setItem('userId', userId);
          localStorage.setItem('userType', userType);
          router.push('/chat');
        } else {
          setError('Invalid email address');
          toast({type: 'error', description: 'Invalid email address'});
        }
      }
    } catch (err) {
      setError('Failed to get user id');
      toast({type: 'error', description: 'Invalid email address'});
    }
  }

  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-md p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-zinc-600 font-normal dark:text-zinc-400">
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit">Continue</Button>
      </form>
    </div>
  );
}
