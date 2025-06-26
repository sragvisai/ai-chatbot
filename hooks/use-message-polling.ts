import { useEffect } from 'react';

export interface UseMessagePollingParams {
  chatId: string;
  after: string | null;
  userId: string;
  onMessage: (msg: any) => void;
}

export function useMessagePolling({ chatId, after, userId, onMessage }: UseMessagePollingParams) {
  useEffect(() => {
    if (!after) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat?chatId=${chatId}&after=${after}&userId=${userId}`);
        if (res.status === 200) {
          const data = await res.json();
          if (!cancelled) {
            onMessage(data);
            cancelled = true;
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error('Polling failed', error);
      }
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chatId, after, userId, onMessage]);
}
