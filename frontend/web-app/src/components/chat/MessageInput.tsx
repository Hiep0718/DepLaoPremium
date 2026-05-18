import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Paperclip, Send, Smile, Image as ImageIcon, ThumbsUp, Sticker,
  ScreenShare, Code, Type, X, FileText, Film, Loader2,
  Mic, Trash2, Contact, BarChart2, MoreHorizontal, MapPin, CalendarClock, Clock, Navigation
} from 'lucide-react';
import ContactSelectionModal from './ContactSelectionModal';
import CreatePollModal from './CreatePollModal';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { socket } from '../../services/socket';
import { createConversation } from '../../services/message.service';
import { streamAiChat } from '../../services/aiChat.service';
import { uploadChatFile } from '../../services/upload.service';
import { STICKERS } from '../../constants/stickers';
import { showToast } from '../../services/notification.service';
import api from '../../services/axios';

// Helper: format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const MessageInput = () => {
  const { activeConversation, setActiveConversation, addMessage, replyingMessage, setReplyingMessage } = useChatStore();
  const { user } = useAuthStore();
  const [text, setText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Location state
  const [isSendingLocation, setIsSendingLocation] = useState(false);

  // Reminder states
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');

  // Smart time suggestion
  const [timeSuggestion, setTimeSuggestion] = useState<{ text: string; date: Date } | null>(null);

  const [isPollModalOpen, setIsPollModalOpen] = useState(false);

  // Mention States
  const [mentionKeyword, setMentionKeyword] = useState<string | null>(null);
  const [memberMap, setMemberMap] = useState<Record<string, { fullName: string; avatarUrl?: string }>>({});

  // Fetch members for mentions
  useEffect(() => {
    if (!activeConversation?.isGroup || !activeConversation.participants?.length) return;
    const fetchMembers = async () => {
      const map: Record<string, { fullName: string; avatarUrl?: string }> = {};
      for (const p of activeConversation.participants) {
        const uid = String((p as any).userId || (p as any).id || p);
        if (!uid) continue;
        try {
          const res = await api.get(`/users/${uid}`);
          if (res.data?.data) {
            map[uid] = { fullName: res.data.data.fullName || res.data.data.nickname || 'Thành viên', avatarUrl: res.data.data.avatarUrl };
          }
        } catch { /* skip */ }
      }
      setMemberMap(map);
    };
    fetchMembers();
  }, [activeConversation?.conversationId, activeConversation?.isGroup, activeConversation?.participants]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    
    if (activeConversation?.isGroup) {
      const match = val.match(/(?:^|\s)@([^@]*)$/);
      if (match) {
        setMentionKeyword(match[1]);
      } else {
        setMentionKeyword(null);
      }
    }
  };

  const handleMentionSelect = (fullName: string) => {
    const match = text.match(/(?:^|\s)@([^@]*)$/);
    if (match) {
       const beforeAt = text.substring(0, text.length - match[0].length + (match[0].startsWith(' ') ? 1 : 0));
       const newText = beforeAt + '@' + fullName + ' ';
       setText(newText);
       setMentionKeyword(null);
       const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
       if (textarea) textarea.focus();
    }
  };

  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isListeningText, setIsListeningText] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const speechRecognitionRef = useRef<any>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stickerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const isGroup = activeConversation?.isGroup;
  const myRole = useMemo(() => {
    if (!isGroup || !user?.id) return 'member';
    const me = activeConversation.participants?.find(
      (p: any) => String(p.userId || p.id || p) === String(user.id)
    );
    return (me as any)?.role || 'member';
  }, [activeConversation, user?.id, isGroup]);

  const canSendMessage = useMemo(() => {
    if (!isGroup) return true;
    if (activeConversation.groupSettings?.sendMessages === 'admin_only') {
      return myRole === 'leader' || myRole === 'deputy';
    }
    return true;
  }, [activeConversation?.groupSettings?.sendMessages, myRole, isGroup]);

  const canCreatePoll = useMemo(() => {
    if (!isGroup) return true;
    if (activeConversation.groupSettings?.pinAndPolls === 'admin_only') {
      return myRole === 'leader' || myRole === 'deputy';
    }
    return true;
  }, [activeConversation?.groupSettings?.pinAndPolls, myRole, isGroup]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (stickerRef.current && !stickerRef.current.contains(event.target as Node)) {
        setShowStickers(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handlePrompt = ((e: CustomEvent) => {
      setText(e.detail);
      setTimeout(() => {
        const input = document.querySelector('textarea') as HTMLTextAreaElement;
        if (input) input.focus();
      }, 0);
    }) as EventListener;
    window.addEventListener('ai_prompt_selected', handlePrompt);
    return () => window.removeEventListener('ai_prompt_selected', handlePrompt);
  }, []);

  // Clean up preview URLs and recording timer on unmount
  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [previewUrls]);

  // Ensure conversation exists (shared logic)
  const ensureConversation = async () => {
    let currentConversation = activeConversation;
    if (!currentConversation || !user) return null;

    if (currentConversation.conversationId.startsWith('new_') || currentConversation.conversationId.startsWith('contact_')) {
      try {
        const friendPart = currentConversation.participants[0];
        const friendId = friendPart.contactUserId || friendPart.id || friendPart.userId;
        const res = await createConversation([user.id.toString(), friendId.toString()], false);
        if (res.data?.data) {
          currentConversation = res.data.data;
          setActiveConversation(res.data.data);
        } else if (res.data) {
          currentConversation = res.data;
          setActiveConversation(res.data);
        }
      } catch (err) {
        console.error('Failed to create conversation', err);
        return null;
      }
    }
    return currentConversation;
  };

  // Get recipient ID from conversation
  const getRecipientId = (conv: any) => {
    if (!user) return undefined;
    const recipientPart = conv.isGroup
      ? null
      : conv.participants.find((p: any) =>
        p !== user.id && p !== user.id.toString() &&
        p.id !== user.id && p.id?.toString() !== user.id.toString() &&
        p.userId !== user.id && p.userId !== user.id.toString() &&
        p.contactUserId !== user.id && p.contactUserId?.toString() !== user.id.toString()
      );
    return recipientPart?.userId || recipientPart?.contactUserId || recipientPart?.id || recipientPart;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeConversation || !user) return;

    const isAi = activeConversation.conversationId.startsWith('ai_');
    const activeText = text.trim();
    setText('');

    if (isAi) {
      // ── AI Chat Route ──
      const { addMessage, setAiStreaming, appendAiToken, finishAiStream } = useChatStore.getState();
      const tempId = Date.now().toString() + Math.random().toString(36).substring(7);
      addMessage({
        id: tempId,
        conversationId: activeConversation.conversationId,
        senderId: user.id.toString(),
        content: activeText,
        text: activeText,
        messageType: 'text',
        createdAt: new Date().toISOString(),
      });
      setAiStreaming(true);
      await streamAiChat(
        user.id.toString(),
        activeText,
        (token) => appendAiToken(token),
        () => finishAiStream(user.id.toString()),
        (errMsg) => {
          setAiStreaming(false);
          showToast('Bếp AI', errMsg, 'error');
        }
      );
      return;
    }

    // ── Normal Chat Route ──
    const currentConversation = await ensureConversation();
    if (!currentConversation) { return; }

    const recipientId = getRecipientId(currentConversation);
    const tempId = Date.now().toString() + Math.random().toString(36).substring(7);

    const messagePayload = {
      tempId,
      conversationId: currentConversation.conversationId,
      senderId: user.id.toString(),
      recipientId: recipientId?.toString(),
      text: activeText,
      messageType: 'text',
      fileUrl: undefined,
      replyTo: replyingMessage ? {
        messageId: replyingMessage.id || replyingMessage._id || '',
        content: replyingMessage.content || replyingMessage.text || '',
        senderId: replyingMessage.senderId,
        messageType: replyingMessage.messageType || 'text',
      } : undefined,
    };

    socket.emit('send_message', messagePayload);
    addMessage({ id: tempId, ...messagePayload, createdAt: new Date().toISOString() });
    setReplyingMessage(null);
  };

  const sendSticker = async (stickerUrl: string) => {
    if (!activeConversation || !user) return;

    const currentConversation = await ensureConversation();
    if (!currentConversation) return;

    const recipientId = getRecipientId(currentConversation);
    const tempId = Date.now().toString() + Math.random().toString(36).substring(7);

    const messagePayload = {
      tempId,
      conversationId: currentConversation.conversationId,
      senderId: user.id.toString(),
      recipientId: recipientId?.toString(),
      text: '[Nhãn dán]',
      messageType: 'sticker',
      fileUrl: stickerUrl,
      replyTo: replyingMessage ? {
        messageId: replyingMessage.id || replyingMessage._id || '',
        content: replyingMessage.content || replyingMessage.text || '',
        senderId: replyingMessage.senderId,
        messageType: replyingMessage.messageType || 'text',
      } : undefined,
    };

    socket.emit('send_message', messagePayload);
    addMessage({ id: tempId, ...messagePayload, createdAt: new Date().toISOString() });
    setShowStickers(false);
    setReplyingMessage(null);
  };

  const sendContact = async (contactInfo: any) => {
    if (!activeConversation || !user) return;

    const currentConversation = await ensureConversation();
    if (!currentConversation) return;

    const recipientId = getRecipientId(currentConversation);
    const tempId = Date.now().toString() + Math.random().toString(36).substring(7);

    const messagePayload = {
      tempId,
      conversationId: currentConversation.conversationId,
      senderId: user.id.toString(),
      recipientId: recipientId?.toString(),
      text: '[Danh thiếp]',
      content: JSON.stringify(contactInfo),
      messageType: 'contact',
      fileUrl: undefined,
      replyTo: replyingMessage ? {
        messageId: replyingMessage.id || replyingMessage._id || '',
        content: replyingMessage.content || replyingMessage.text || '',
        senderId: replyingMessage.senderId,
        messageType: replyingMessage.messageType || 'text',
      } : undefined,
    };

    socket.emit('send_message', messagePayload);
    addMessage({ id: tempId, ...messagePayload, createdAt: new Date().toISOString() });
    setReplyingMessage(null);
  };

  // ── SEND LOCATION ──
  const sendLocation = async () => {
    if (!activeConversation || !user) return;
    if (!navigator.geolocation) {
      showToast('Lỗi', 'Trình duyệt không hỗ trợ định vị.', 'error');
      return;
    }
    setIsSendingLocation(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=vi`);
        const geo = await res.json();
        if (geo.display_name) address = geo.display_name;
      } catch {}

      const currentConversation = await ensureConversation();
      if (!currentConversation) return;
      const recipientId = getRecipientId(currentConversation);
      const tempId = Date.now().toString() + Math.random().toString(36).substring(7);
      const content = JSON.stringify({ latitude, longitude, address });

      const messagePayload = {
        tempId,
        conversationId: currentConversation.conversationId,
        senderId: user.id.toString(),
        recipientId: recipientId?.toString(),
        text: content,
        messageType: 'location',
      };
      socket.emit('send_message', messagePayload);
      addMessage({ id: tempId, ...messagePayload, content, createdAt: new Date().toISOString() });
    } catch (err: any) {
      if (err?.code === 1) showToast('Quyền truy cập', 'Vui lòng cho phép truy cập vị trí trong trình duyệt.', 'error');
      else showToast('Lỗi', 'Không thể lấy vị trí hiện tại.', 'error');
    } finally {
      setIsSendingLocation(false);
    }
  };

  // ── SEND REMINDER ──
  const sendReminder = async () => {
    if (!activeConversation || !user) return;
    if (!reminderText.trim()) { showToast('Thông báo', 'Vui lòng nhập nội dung nhắc hẹn.', 'error'); return; }
    if (!reminderDate || !reminderTime) { showToast('Thông báo', 'Vui lòng chọn ngày và giờ.', 'error'); return; }

    const reminderDateTime = new Date(`${reminderDate}T${reminderTime}`);
    if (isNaN(reminderDateTime.getTime()) || reminderDateTime <= new Date()) {
      showToast('Thông báo', 'Thời gian nhắc hẹn phải ở tương lai.', 'error');
      return;
    }

    const currentConversation = await ensureConversation();
    if (!currentConversation) return;
    const recipientId = getRecipientId(currentConversation);
    const tempId = Date.now().toString() + Math.random().toString(36).substring(7);
    const content = JSON.stringify({ text: reminderText.trim(), reminderTime: reminderDateTime.toISOString() });

    const messagePayload = {
      tempId,
      conversationId: currentConversation.conversationId,
      senderId: user.id.toString(),
      recipientId: recipientId?.toString(),
      text: content,
      messageType: 'reminder',
    };
    socket.emit('send_message', messagePayload);
    addMessage({ id: tempId, ...messagePayload, content, createdAt: new Date().toISOString() });
    setIsReminderModalOpen(false);
    setReminderText('');
    setReminderDate('');
    setReminderTime('');
  };

  // ── SMART TIME DETECTION ──
  const detectTimeInText = (input: string) => {
    if (!input || input.length < 3) { setTimeSuggestion(null); return; }
    const now = new Date();
    const patterns: { regex: RegExp; parse: (m: RegExpMatchArray) => { text: string; date: Date } | null }[] = [
      { regex: /(\d{1,2})[hH:](\d{0,2})\s*(sáng|chiều|tối)?/i, parse: (m) => {
        let h = parseInt(m[1]); const min = m[2] ? parseInt(m[2]) : 0; const period = m[3]?.toLowerCase();
        if (period === 'chiều' && h < 12) h += 12; if (period === 'tối' && h < 18) h += 6;
        const d = new Date(now); d.setHours(h, min, 0, 0); if (d <= now) d.setDate(d.getDate() + 1);
        return { text: `${h.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`, date: d };
      }},
      { regex: /(\d{1,2})\s*giờ\s*(\d{0,2})\s*(sáng|chiều|tối|phút)?/i, parse: (m) => {
        let h = parseInt(m[1]); const min = m[2] ? parseInt(m[2]) : 0; const period = m[3]?.toLowerCase();
        if (period === 'chiều' && h < 12) h += 12; if (period === 'tối' && h < 18) h += 6;
        const d = new Date(now); d.setHours(h, min, 0, 0); if (d <= now) d.setDate(d.getDate() + 1);
        return { text: `${h.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`, date: d };
      }},
      { regex: /(sáng mai|chiều mai|tối mai|ngày mai)/i, parse: (m) => {
        const d = new Date(now); d.setDate(d.getDate() + 1);
        const kw = m[1].toLowerCase();
        if (kw.includes('sáng')) d.setHours(8, 0, 0, 0);
        else if (kw.includes('chiều')) d.setHours(14, 0, 0, 0);
        else if (kw.includes('tối')) d.setHours(19, 0, 0, 0);
        else d.setHours(9, 0, 0, 0);
        return { text: m[1], date: d };
      }},
      { regex: /(sáng nay|chiều nay|tối nay)/i, parse: (m) => {
        const d = new Date(now); const kw = m[1].toLowerCase();
        if (kw.includes('sáng')) d.setHours(8, 0, 0, 0);
        else if (kw.includes('chiều')) d.setHours(14, 0, 0, 0);
        else d.setHours(19, 0, 0, 0);
        if (d <= now) return null;
        return { text: m[1], date: d };
      }},
      { regex: /(tuần sau|tuần tới)/i, parse: (m) => {
        const d = new Date(now); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0);
        return { text: m[1], date: d };
      }},
      { regex: /(cuối tuần)/i, parse: (m) => {
        const d = new Date(now); const day = d.getDay(); const diff = day === 0 ? 6 : (6 - day);
        d.setDate(d.getDate() + diff); d.setHours(9, 0, 0, 0); if (d <= now) d.setDate(d.getDate() + 7);
        return { text: m[1], date: d };
      }},
      { regex: /(\d{1,2})\s*(phút|tiếng|giờ)\s*nữa/i, parse: (m) => {
        const num = parseInt(m[1]); const unit = m[2].toLowerCase();
        const d = new Date(now);
        if (unit === 'phút') d.setMinutes(d.getMinutes() + num);
        else d.setHours(d.getHours() + num);
        return { text: `${num} ${m[2]} nữa`, date: d };
      }},
    ];
    for (const p of patterns) {
      const match = input.match(p.regex);
      if (match) { const result = p.parse(match); if (result && result.date > now) { setTimeSuggestion(result); return; } }
    }
    setTimeSuggestion(null);
  };

  // Detect time when text changes
  useEffect(() => { detectTimeInText(text); }, [text]);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const validFiles: File[] = [];
    const validPreviews: string[] = [];
    for (const f of newFiles) {
      if (f.size > 50 * 1024 * 1024) {
        showToast('Lỗi tải tệp', `Tệp "${f.name}" vượt quá dung lượng giới hạn (50MB)`, 'error');
      } else {
        validFiles.push(f);
        validPreviews.push(URL.createObjectURL(f));
      }
    }

    if (validFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...validFiles]);
      setPreviewUrls(prev => [...prev, ...validPreviews]);
    }

    // Reset the input
    e.target.value = '';
  };

  // Handle file selection  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const validFiles: File[] = [];

    for (const f of newFiles) {
      if (f.size > 50 * 1024 * 1024) {
        showToast('Lỗi tải tệp', `Tệp "${f.name}" vượt quá dung lượng giới hạn (50MB)`, 'error');
      } else {
        validFiles.push(f);
      }
    }

    if (validFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...validFiles]);
      setPreviewUrls(prev => [...prev, ...validFiles.map(() => '')]);
    }

    e.target.value = '';
  };

  // Remove a pending file
  const removePendingFile = (index: number) => {
    if (previewUrls[index]) URL.revokeObjectURL(previewUrls[index]);
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Send pending files
  const sendFiles = async () => {
    if (pendingFiles.length === 0 || !activeConversation || !user) return;

    const isAi = activeConversation.conversationId.startsWith('ai_');

    if (isAi) {
      const file = pendingFiles[0];
      if (!file.type.startsWith('image/')) {
        showToast('Bếp AI', 'AI chỉ hỗ trợ phân tích hình ảnh.', 'error');
        return;
      }
      setUploading(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const { addMessage, setAiStreaming, appendAiToken, finishAiStream } = useChatStore.getState();
          const tempId = Date.now().toString() + Math.random().toString(36).substring(7);
          
          const activeText = text.trim();
          setText('');
          setPendingFiles([]);
          setPreviewUrls([]);

          addMessage({
            id: tempId + '_img',
            conversationId: activeConversation.conversationId,
            senderId: user.id.toString(),
            content: `[Hình ảnh]`,
            text: `[Hình ảnh]`,
            messageType: 'image',
            fileUrl: base64data,
            createdAt: new Date().toISOString(),
          } as any);

          if (activeText) {
            addMessage({
              id: tempId + '_txt',
              conversationId: activeConversation.conversationId,
              senderId: user.id.toString(),
              content: activeText,
              text: activeText,
              messageType: 'text',
              createdAt: new Date().toISOString(),
            } as any);
          }

          setAiStreaming(true);
          await streamAiChat(
            user.id.toString(),
            activeText,
            (token) => appendAiToken(token),
            () => finishAiStream(user.id.toString()),
            (errMsg) => {
              setAiStreaming(false);
              showToast('Bếp AI', errMsg, 'error');
            },
            base64data,
            file.type
          );
        };
        reader.readAsDataURL(file);
      } finally {
        setUploading(false);
      }
      return;
    }

    const currentConversation = await ensureConversation();
    if (!currentConversation) return;

    const recipientId = getRecipientId(currentConversation);
    setUploading(true);

    try {
      for (const file of pendingFiles) {
        const tempId = Date.now().toString() + Math.random().toString(36).substring(7);

        // Determine local messageType for preview
        let localType: string = 'file';
        if (file.type.startsWith('image/')) localType = 'image';
        else if (file.type.startsWith('video/')) localType = 'video';
        else if (file.type.startsWith('audio/')) localType = 'audio';

        const previewText = localType === 'image' ? '[Hình ảnh]' : localType === 'video' ? '[Video]' : localType === 'audio' ? '[Tin nhắn thoại]' : `[Tệp] ${file.name}`;

        // Optimistic add
        addMessage({
          id: tempId,
          conversationId: currentConversation.conversationId,
          senderId: user.id.toString(),
          text: previewText,
          messageType: localType,
          fileUrl: URL.createObjectURL(file),
          fileName: file.name,
          fileSize: file.size,
          createdAt: new Date().toISOString(),
          _uploading: true,
        } as any);

        try {
          // Upload to S3
          const result = await uploadChatFile(file);

          const messagePayload = {
            tempId,
            conversationId: currentConversation.conversationId,
            senderId: user.id.toString(),
            recipientId: recipientId?.toString(),
            text: previewText,
            messageType: result.messageType,
            fileUrl: result.url,
            fileName: result.fileName,
            fileSize: result.fileSize,
            replyTo: replyingMessage ? {
              messageId: replyingMessage.id || replyingMessage._id || '',
              content: replyingMessage.content || replyingMessage.text || '',
              senderId: replyingMessage.senderId,
              messageType: replyingMessage.messageType || 'text',
            } : undefined,
          };

          socket.emit('send_message', messagePayload);

          // Update optimistic message with real URL
          const { updateMessage } = useChatStore.getState();
          updateMessage(tempId, {
            fileUrl: result.url,
            messageType: result.messageType,
            _uploading: false,
          } as any);
        } catch (err) {
          console.error('Upload failed for file:', file.name, err);
          // Mark as failed
          const { updateMessage } = useChatStore.getState();
          updateMessage(tempId, { _uploadFailed: true, _uploading: false } as any);
        }
      }
    } finally {
      setUploading(false);
      setPendingFiles([]);
      previewUrls.forEach(url => { if (url) URL.revokeObjectURL(url); });
      setPreviewUrls([]);
      setReplyingMessage(null);
    }
  };

  // Handle paste for images
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          if (file.size > 50 * 1024 * 1024) {
            showToast('Lỗi tải tệp', 'Hình ảnh dán vượt quá dung lượng giới hạn (50MB)', 'error');
          } else {
            const preview = URL.createObjectURL(file);
            setPendingFiles(prev => [...prev, file]);
            setPreviewUrls(prev => [...prev, preview]);
          }
        }
        break;
      }
    }
  };

  // --- VOICE RECORDING LOGIC ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Clean up tracks to stop microphone usage indicator
        stream.getTracks().forEach(track => track.stop());

        // Create a File from Blob
        const file = new File([audioBlob], `voice_message_${Date.now()}.webm`, { type: 'audio/webm' });

        // Push file to pendingFiles and trigger send directly
        setPendingFiles([file]);
        setPreviewUrls(['']); // No preview url needed for audio right away
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Microphone access denied or error:', err);
      // Optional: Add a toast notification here "Vui lòng cấp quyền Microphone"
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // Clearing chunks before they process ensures we don't send anything
      audioChunksRef.current = [];
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingTime(0);
  };

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop(); // Triggers onstop and creates file -> pendingFiles
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingTime(0);
    // We rely on an effect to automatically sendFiles if pendingFiles was updated with an audio message
    setTimeout(() => {
      sendFiles();
    }, 100);
  };

  const formatRecordTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleSpeechToText = () => {
    if (isListeningText) {
      if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
      setIsListeningText(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Lỗi", "Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng dùng Chrome/Edge.", "error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
         setText(prev => (prev + ' ' + finalTranscript).trim());
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = () => {
      setIsListeningText(false);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      setIsListeningText(false);
      setInterimTranscript('');
    };

    recognition.start();
    speechRecognitionRef.current = recognition;
    setIsListeningText(true);
  };

  if (!activeConversation) return null;

  const isAiConversation = activeConversation.conversationId.startsWith('ai_');
  const isAiStreaming = useChatStore.getState().isAiStreaming;

  // Get recipient name for placeholder
  const contact = activeConversation.participants?.[0];
  const recipientName = isAiConversation ? 'Bếp AI' : (contact ? (contact.fullName || 'bạn bè') : 'bạn bè');

  // AI suggestion chips — dynamic based on context
  const messages = useChatStore.getState().messages;
  const lastAiMsg = [...messages].reverse().find(m => m.senderId === 'ai_food_bot');
  const lastUserMsg = [...messages].reverse().find(m => m.senderId === user?.id?.toString());

  const getAiSuggestions = (): string[] => {
    if (!lastAiMsg && !lastUserMsg) {
      // First time - show starter suggestions
      return [
        '🍜 Công thức phở bò',
        '🥗 Gợi ý món ăn healthy',
        '🍳 Nấu gì từ trứng và rau?',
        '🌶️ Món ngon miền Trung',
      ];
    }

    const lastContent = (lastAiMsg?.content || lastAiMsg?.text || '').toLowerCase();

    // Context-aware follow-up suggestions
    if (lastContent.includes('phở') || lastContent.includes('bún') || lastContent.includes('mì')) {
      return ['🥢 Cách nấu nước dùng đậm đà', '🌿 Rau ăn kèm phở', '🔥 Mẹo nấu phở ngon hơn'];
    }
    if (lastContent.includes('bánh') || lastContent.includes('tráng miệng') || lastContent.includes('ngọt')) {
      return ['🎂 Thêm công thức bánh khác', '🍮 Món tráng miệng không cần lò', '🧊 Món chè mùa hè'];
    }
    if (lastContent.includes('rau') || lastContent.includes('chay') || lastContent.includes('healthy')) {
      return ['🥑 Salad kiểu Việt', '🍲 Món chay đơn giản', '💪 Thực đơn giảm cân 1 tuần'];
    }
    if (lastContent.includes('gà') || lastContent.includes('thịt') || lastContent.includes('cá')) {
      return ['🍗 Cách ướp thịt ngon', '🐟 Món cá kho tộ', '🥩 Thịt bò xào đơn giản'];
    }

    // Rotating default suggestions
    const suggestionSets = [
      ['🍜 Công thức phở bò', '🥗 Món ăn cho bữa sáng', '🍳 Nấu gì nhanh trong 15 phút?'],
      ['🌶️ Ẩm thực miền Trung', '🧁 Món tráng miệng dễ làm', '💡 Mẹo nấu ăn hay'],
      ['🍲 Món canh ngon cho gia đình', '🥘 Món hầm mùa đông', '🍚 Cơm rang đặc biệt'],
    ];
    const setIdx = messages.length % suggestionSets.length;
    return suggestionSets[setIdx];
  };

  const aiSuggestions = isAiConversation ? getAiSuggestions() : [];

  // Zalo toolbar icons — matches real Zalo PC exactly
  const toolButtons = isAiConversation ? [
    { icon: ImageIcon, title: 'Gửi ảnh cho Bếp AI', action: () => imageInputRef.current?.click() }
  ] : [
    { icon: Sticker, title: 'Sticker', action: () => setShowStickers(!showStickers) },
    { icon: ImageIcon, title: 'Hình ảnh', action: () => imageInputRef.current?.click() },
    { icon: Paperclip, title: 'Đính kèm tệp', action: () => fileInputRef.current?.click() },
    { icon: Contact, title: 'Gửi danh thiếp', action: () => setIsContactModalOpen(true) },
    { icon: MapPin, title: isSendingLocation ? 'Đang lấy vị trí...' : 'Gửi vị trí', action: () => !isSendingLocation && sendLocation() },
    { icon: CalendarClock, title: 'Tạo nhắc hẹn', action: () => setIsReminderModalOpen(true) },
    { icon: Mic, title: 'Gửi tin nhắn thoại', action: () => startRecording() },
    ...(activeConversation.isGroup && canCreatePoll ? [{ icon: BarChart2, title: 'Tạo bình chọn', action: () => setIsPollModalOpen(true) }] : [])
  ];

  if (!canSendMessage) {
    return (
      <div className="relative z-10 theme-transition flex items-center justify-center p-4 text-center h-[93px]" style={{ background: 'var(--bg-input)', borderTop: '1px solid var(--border-primary)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Chỉ Trưởng/Phó nhóm mới được gửi tin nhắn vào nhóm này.</p>
      </div>
    );
  }

  return (
    <div className="relative z-10 theme-transition" style={{ background: 'var(--bg-input)', borderTop: '1px solid var(--border-primary)' }}>
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleImageSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Zalo-style Toolbar */}
      <div className="flex items-center px-2 py-1 relative" style={{ borderBottom: '1px solid var(--border-light)' }}>
        {toolButtons.map((btn, i) => (
          <button key={i} type="button"
            className="p-2 rounded-md transition-all duration-150 hover:scale-105"
            style={{ color: btn.title === 'Sticker' && showStickers ? '#0068FF' : 'var(--text-secondary)' }}
            onClick={() => btn.action?.()}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              if (btn.title !== 'Sticker' || !showStickers) e.currentTarget.style.color = 'var(--text-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              if (btn.title !== 'Sticker' || !showStickers) e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title={btn.title}
          >
            <btn.icon size={19} strokeWidth={1.5} />
          </button>
        ))}

        {/* More button (Zalo style) */}
        {!isAiConversation && (
          <button type="button"
            className="p-2 rounded-md transition-all duration-150 hover:scale-105"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="Thêm"
          >
            <MoreHorizontal size={19} strokeWidth={1.5} />
          </button>
        )}

        {/* Sticker Picker Popover */}
        {showStickers && (
          <div ref={stickerRef} className="absolute bottom-full left-0 mb-2 w-80 p-3 rounded-lg shadow-xl animate-fadeIn z-50 border"
            style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-light)' }}>
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-[var(--border-light)]">
              <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Nhãn dán</h4>
              <button type="button" onClick={() => setShowStickers(false)}>
                <X size={16} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
              {STICKERS.map((sticker, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendSticker(sticker)}
                  className="aspect-square p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center cursor-pointer"
                >
                  <img src={sticker} alt="Sticker" className="w-14 h-14 object-contain drop-shadow-md hover:scale-110 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Suggestion Chips — Dynamic */}
      {isAiConversation && !text.trim() && !isAiStreaming && aiSuggestions.length > 0 && (
        <div className="flex gap-2 px-3 py-2 overflow-x-auto" style={{ borderBottom: '1px solid var(--border-light)' }}>
          {aiSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setText(s.replace(/^[^\s]+\s/, ''))}
              className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all flex-shrink-0 hover:scale-105"
              style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(249,115,22,0.2)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(249,115,22,0.12)'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Pending Files Preview */}
      {pendingFiles.length > 0 && (
        <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-panel)' }}>
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            {pendingFiles.map((file, idx) => (
              <div key={idx} className="relative flex-shrink-0 group/preview">
                {file.type.startsWith('image/') ? (
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-[var(--border-light)] bg-[var(--bg-hover)]">
                    <img src={previewUrls[idx]} alt={file.name} className="w-full h-full object-cover" />
                  </div>
                ) : file.type.startsWith('video/') ? (
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-[var(--border-light)] bg-[var(--bg-hover)] flex flex-col items-center justify-center gap-1">
                    <Film size={24} style={{ color: 'var(--text-secondary)' }} />
                    <span className="text-[10px] text-center truncate w-full px-1" style={{ color: 'var(--text-secondary)' }}>
                      {file.name.length > 10 ? file.name.substring(0, 10) + '...' : file.name}
                    </span>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-[var(--border-light)] bg-[var(--bg-hover)] flex flex-col items-center justify-center gap-1 px-1">
                    <FileText size={24} style={{ color: 'var(--text-secondary)' }} />
                    <span className="text-[10px] text-center truncate w-full" style={{ color: 'var(--text-secondary)' }}>
                      {file.name.length > 10 ? file.name.substring(0, 10) + '...' : file.name}
                    </span>
                    <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePendingFile(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center
                    opacity-0 group-hover/preview:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Smart Time Suggestion Banner ── */}
      {timeSuggestion && !isAiConversation && (
        <div className="flex items-center justify-between px-3 py-2 animate-fadeIn" style={{ background: 'rgba(255,99,72,0.08)', borderBottom: '1px solid rgba(255,99,72,0.15)' }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: '#FF6348' }}>
            <CalendarClock size={15} />
            <span>Phát hiện thời gian <b>"{timeSuggestion.text}"</b> — Tạo nhắc hẹn?</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all hover:scale-105"
              style={{ background: '#FF6348', color: '#fff' }}
              onClick={() => {
                setReminderText(text);
                const d = timeSuggestion.date;
                setReminderDate(`${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`);
                setReminderTime(`${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`);
                setIsReminderModalOpen(true);
                setTimeSuggestion(null);
              }}
            >
              Tạo nhắc hẹn
            </button>
            <button type="button" className="p-1 rounded-full hover:bg-[rgba(255,99,72,0.15)]" onClick={() => setTimeSuggestion(null)}>
              <X size={14} style={{ color: '#FF6348' }} />
            </button>
          </div>
        </div>
      )}

      {/* Replying Preview Banner */}
      {replyingMessage && (
        <div className="flex items-center justify-between px-3 py-2 text-sm border-b" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-light)' }}>
          <div className="flex flex-col pl-2 border-l-2 border-[#0068FF] overflow-hidden">
            <span className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>
              Đang trả lời {replyingMessage.senderId === user.id.toString() ? 'chính mình' : 'người khác'}
            </span>
            <span className="truncate text-xs mt-0.5 opacity-80" style={{ color: 'var(--text-secondary)' }}>
              {replyingMessage.messageType === 'sticker' ? '[Nhãn dán]' :
                replyingMessage.messageType === 'image' ? '[Hình ảnh]' :
                  replyingMessage.messageType === 'contact' ? '[Danh thiếp]' :
                    replyingMessage.messageType === 'video' ? '[Video]' :
                      replyingMessage.messageType === 'file' ? '[Tệp]' :
                        (replyingMessage.content || replyingMessage.text)}
            </span>
          </div>
          <button type="button" onClick={() => setReplyingMessage(null)} className="p-1 rounded-full hover:bg-[var(--bg-hover)] transition-colors">
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      )}

      {/* Input Row */}
      <form onSubmit={pendingFiles.length > 0 ? (e) => { e.preventDefault(); sendFiles(); } : handleSend} className="flex items-end gap-1 px-3 py-2 min-h-[50px]">
        {isRecording ? (
          /* Voice Recording UI */
          <div className="flex-1 flex items-center justify-between py-2.5 px-4 bg-red-50 rounded-full border border-red-100 mr-2 animate-fadeIn">
            <div className="flex items-center gap-3 text-red-500 font-medium overflow-hidden">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)] shrink-0"></span>
              <span className="text-sm shrink-0">{formatRecordTime(recordingTime)}</span>
              <span className="text-xs truncate opacity-70 whitespace-nowrap hidden sm:inline">Đang ghi âm...</span>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                title="Hủy ghi âm"
              >
                <Trash2 size={18} />
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded-full transition-colors ml-1"
                title="Gửi"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        ) : (
          /* Text Input UI */
          <div className="flex-1 relative">
            {mentionKeyword !== null && isGroup && (
              <div 
                className="absolute left-0 bottom-full mb-2 w-64 max-h-48 overflow-y-auto rounded-xl shadow-lg border custom-scrollbar z-50"
                style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-primary)' }}
              >
                {Object.entries(memberMap)
                  .filter(([uid, userObj]) => 
                    uid !== user?.id?.toString() && 
                    (userObj.fullName.toLowerCase().includes(mentionKeyword.toLowerCase()) || mentionKeyword === '')
                  )
                  .map(([uid, userObj]) => (
                    <button
                      key={uid}
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      onClick={() => handleMentionSelect(userObj.fullName)}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                        {userObj.avatarUrl ? (
                          <img src={userObj.avatarUrl} alt={userObj.fullName} className="w-full h-full object-cover" />
                        ) : (
                          userObj.fullName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {userObj.fullName}
                      </span>
                    </button>
                  ))}
              </div>
            )}
            <textarea
              className="w-full bg-transparent border-0 resize-none py-2 outline-none text-[15px] leading-relaxed"
              style={{ color: 'var(--text-primary)' }}
              rows={1}
              placeholder={isAiConversation
                ? 'Hỏi Bếp AI về ẩm thực...'
                : (pendingFiles.length > 0 ? 'Thêm tin nhắn (tùy chọn)...' : `Nhập @, tin nhắn tới ${recipientName}`)}
              value={text}
              onChange={handleTextChange}
              onPaste={handlePaste}
              disabled={isAiConversation && isAiStreaming}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (pendingFiles.length > 0) {
                    sendFiles();
                  } else {
                    handleSend(e);
                  }
                }
              }}
            />
            {/* Live STT Preview Overlay */}
            {isListeningText && (
              <div className="absolute top-[-36px] left-0 right-0 pointer-events-none flex justify-center z-10 animate-fadeIn">
                <div className="bg-[#0068FF] text-white px-4 py-1.5 rounded-full text-xs shadow-lg flex items-center gap-2 max-w-[90%]">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping shrink-0"></span>
                  <span className="truncate">
                    {interimTranscript ? interimTranscript : "Đang nghe... Hãy nói gì đó"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-0.5 pb-1.5">
          <button type="button" className="p-2 rounded-md transition-all duration-150"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            title="Biểu tượng cảm xúc"
          >
            <Smile size={22} strokeWidth={1.5} />
          </button>

          {(text.trim() || pendingFiles.length > 0) ? (
            <button
              type="submit"
              disabled={uploading}
              className="p-2 rounded-md transition-all duration-150 disabled:opacity-50"
              style={{ color: '#0068FF' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title={uploading ? 'Đang tải lên...' : 'Gửi'}
            >
              {uploading ? (
                <Loader2 size={22} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <Send size={22} strokeWidth={1.5} />
              )}
            </button>
          ) : isAiConversation ? (
            <button type="button" onClick={toggleSpeechToText} className="p-2 rounded-md transition-all duration-150 relative"
              style={{ color: isListeningText ? '#ef4444' : '#0068FF' }}
              onMouseEnter={(e) => { if(!isListeningText) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { if(!isListeningText) e.currentTarget.style.background = 'transparent'; }}
              title={isListeningText ? "Đang nghe... Nhấp để dừng" : "Nhập bằng giọng nói"}
            >
              {isListeningText && (
                 <span className="absolute inset-0 m-auto w-8 h-8 bg-red-400 rounded-full animate-ping opacity-30 pointer-events-none"></span>
              )}
              <Mic size={22} strokeWidth={1.5} className={isListeningText ? "animate-pulse" : ""} />
            </button>
          ) : !isRecording ? (
            <button type="button" className="p-2 rounded-md transition-all duration-150"
              style={{ color: '#0068FF' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              title="Gửi lượt thích"
            >
              <ThumbsUp size={22} strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
      </form>

      <ContactSelectionModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onSelect={sendContact}
      />

      {isPollModalOpen && createPortal(
        <CreatePollModal
          isOpen={isPollModalOpen}
          onClose={() => setIsPollModalOpen(false)}
          conversationId={activeConversation.conversationId}
        />,
        document.body
      )}

      {/* ── Reminder Modal ── */}
      {isReminderModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 animate-fadeIn" onClick={() => setIsReminderModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-bounce-in" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-panel)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,99,72,0.12)' }}>
                  <CalendarClock size={20} style={{ color: '#FF6348' }} />
                </div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Tạo nhắc hẹn</h3>
              </div>
              <button className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] transition-colors" onClick={() => setIsReminderModalOpen(false)}>
                <X size={18} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Nội dung nhắc hẹn</label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl text-sm resize-none outline-none transition-all focus:ring-2 focus:ring-[#FF6348]/30"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                  rows={2}
                  placeholder="VD: Họp nhóm project..."
                  value={reminderText}
                  onChange={e => setReminderText(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Ngày</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-[#FF6348]/30"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                    value={reminderDate}
                    onChange={e => setReminderDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Giờ</label>
                  <input
                    type="time"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-[#FF6348]/30"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}
                    value={reminderTime}
                    onChange={e => setReminderTime(e.target.value)}
                  />
                </div>
              </div>
              {/* Quick time chips */}
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Gợi ý nhanh</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '30 phút nữa', mins: 30 },
                    { label: '1 giờ nữa', mins: 60 },
                    { label: '3 giờ nữa', mins: 180 },
                    { label: 'Ngày mai 9h', mins: null, fn: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
                  ].map(chip => (
                    <button
                      key={chip.label}
                      type="button"
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105"
                      style={{ background: 'rgba(255,99,72,0.1)', color: '#FF6348', border: '1px solid rgba(255,99,72,0.2)' }}
                      onClick={() => {
                        const d = chip.fn ? chip.fn() : new Date(Date.now() + (chip.mins || 0) * 60000);
                        setReminderDate(`${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`);
                        setReminderTime(`${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`);
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: '1px solid var(--border-light)' }}>
              <button className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => setIsReminderModalOpen(false)}>Hủy</button>
              <button className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: '#FF6348' }}
                onClick={sendReminder}>Gửi nhắc hẹn</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MessageInput;

