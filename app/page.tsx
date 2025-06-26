'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function Page() {
  const [email, setEmail] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data = await res.json();
        const userId = data.userId;
        if (userId) {
          document.cookie = `userId=${userId}; path=/`;
          localStorage.setItem('userId', userId);
          router.push('/chat');
        }
      }
    } catch (err) {
      console.error('Failed to get user id', err);
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
