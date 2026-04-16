import { useState, useRef, useEffect } from 'react';
import {
  Paperclip, Send, Smile, Image as ImageIcon, ThumbsUp, Sticker,
  ScreenShare, Code, Type, X, FileText, Film, Loader2,
  Mic, Trash2, Contact
} from 'lucide-react';
import ContactSelectionModal from './ContactSelectionModal';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { socket } from '../../services/socket';
import { createConversation } from '../../services/message.service';
import { uploadChatFile } from '../../services/upload.service';
import { STICKERS } from '../../constants/stickers';

// Helper: format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const MessageInput = () => {
  const [text, setText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  
  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stickerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { activeConversation, setActiveConversation, addMessage, replyingMessage, setReplyingMessage } = useChatStore();
  const { user } = useAuthStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (stickerRef.current && !stickerRef.current.contains(event.target as Node)) {
        setShowStickers(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clean up preview URLs and recording timer on unmount
  useEffect(() => {
    return () => {
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

    const currentConversation = await ensureConversation();
    if (!currentConversation) { return; }

    const activeText = text.trim();
    setText('');

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

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));

    setPendingFiles(prev => [...prev, ...newFiles]);
    setPreviewUrls(prev => [...prev, ...newPreviews]);

    // Reset the input
    e.target.value = '';
  };

  // Handle file selection  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    setPendingFiles(prev => [...prev, ...newFiles]);
    setPreviewUrls(prev => [...prev, ...newFiles.map(() => '')]);

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
          const preview = URL.createObjectURL(file);
          setPendingFiles(prev => [...prev, file]);
          setPreviewUrls(prev => [...prev, preview]);
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

  if (!activeConversation) return null;

  // Get recipient name for placeholder
  const contact = activeConversation.participants?.[0];
  const recipientName = contact ? (contact.nickname || contact.fullName || 'bạn bè') : 'bạn bè';

  // Zalo toolbar icons — matches real Zalo PC exactly
  const toolButtons = [
    { icon: Sticker, title: 'Sticker', action: () => setShowStickers(!showStickers) },
    { icon: ImageIcon, title: 'Hình ảnh', action: () => imageInputRef.current?.click() },
    { icon: Paperclip, title: 'Đính kèm tệp', action: () => fileInputRef.current?.click() },
    { icon: Contact, title: 'Gửi danh thiếp', action: () => setIsContactModalOpen(true) },
    { icon: ScreenShare, title: 'Chụp màn hình' },
    { icon: Code, title: 'Code Snippet' },
    { icon: Type, title: 'Định dạng tin nhắn' },
    { icon: Mic, title: 'Gửi tin nhắn thoại', action: () => startRecording() }
  ];

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
          <div className="flex-1">
            <textarea
              className="w-full bg-transparent border-0 resize-none py-2 outline-none text-[15px] leading-relaxed"
              style={{ color: 'var(--text-primary)' }}
              rows={1}
              placeholder={pendingFiles.length > 0 ? 'Thêm tin nhắn (tùy chọn)...' : `Nhập @, tin nhắn tới ${recipientName}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={handlePaste}
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
    </div>
  );
};

export default MessageInput;
