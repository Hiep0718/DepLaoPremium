import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';

/**
 * Hook that dynamically updates the browser tab favicon and title
 * to show unread message count — similar to Zalo Web behavior.
 * 
 * - Shows a red badge with count on the favicon when there are unread messages
 * - Updates document.title with "(N)" prefix
 * - Reverts to normal when all messages are read
 */
export const useFaviconBadge = () => {
  const conversations = useChatStore((s) => s.conversations);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const originalTitle = useRef('DepLao');

  // Calculate total unread count across all conversations
  const totalUnread = conversations.reduce(
    (sum, conv) => sum + (conv.unreadCount || 0),
    0
  );

  useEffect(() => {
    // Create offscreen canvas once
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 64;
      canvasRef.current.height = 64;
    }

    // Load base favicon image once
    if (!baseImageRef.current) {
      const img = new Image();
      img.src = '/favicon.svg';
      img.onload = () => {
        baseImageRef.current = img;
        updateFavicon(totalUnread);
      };
    } else {
      updateFavicon(totalUnread);
    }

    // Update document title
    if (totalUnread > 0) {
      document.title = `(${totalUnread > 99 ? '99+' : totalUnread}) ${originalTitle.current}`;
    } else {
      document.title = originalTitle.current;
    }
  }, [totalUnread]);

  const updateFavicon = (count: number) => {
    const canvas = canvasRef.current;
    const img = baseImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 64;
    ctx.clearRect(0, 0, size, size);

    // Draw base favicon
    ctx.drawImage(img, 0, 0, size, size);

    if (count > 0) {
      const text = count > 99 ? '99+' : String(count);
      const fontSize = text.length > 2 ? 20 : text.length > 1 ? 24 : 28;

      // Badge dimensions
      const badgeHeight = 28;
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      const measuredWidth = ctx.measureText(text).width;
      const badgeWidth = Math.max(badgeHeight, measuredWidth + 14);
      const badgeX = size - badgeWidth;
      const badgeY = 0;

      // Draw red badge circle/pill
      ctx.beginPath();
      const radius = badgeHeight / 2;
      if (badgeWidth > badgeHeight) {
        // Pill shape for multi-digit
        ctx.moveTo(badgeX + radius, badgeY);
        ctx.lineTo(badgeX + badgeWidth - radius, badgeY);
        ctx.arc(badgeX + badgeWidth - radius, badgeY + radius, radius, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(badgeX + radius, badgeY + badgeHeight);
        ctx.arc(badgeX + radius, badgeY + radius, radius, Math.PI / 2, -Math.PI / 2);
      } else {
        // Circle for single digit
        ctx.arc(badgeX + radius, badgeY + radius, radius, 0, Math.PI * 2);
      }
      ctx.fillStyle = '#FF3B30';
      ctx.fill();

      // White border around badge
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Draw count text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 1);
    }

    // Update favicon link element
    const faviconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (faviconLink) {
      faviconLink.href = canvas.toDataURL('image/png');
    }
  };
};
