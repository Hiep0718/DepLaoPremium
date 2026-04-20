import ChatHeader from '../components/chat/ChatHeader';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';
import ConversationInfoPanel from '../components/chat/ConversationInfoPanel';
import ForwardModal from '../components/chat/ForwardModal';
import { useChatStore } from '../stores/chatStore';

const ChatDesk = () => {
  const isInfoPanelOpen = useChatStore((state) => state.isInfoPanelOpen);
  const activeConversation = useChatStore((state) => state.activeConversation);

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <ChatHeader />
        <MessageList />
        {activeConversation?.leftAt ? (
          <div className="px-4 py-3 text-center text-sm border-t" style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
            Bạn không còn là thành viên của nhóm này
          </div>
        ) : (
          <MessageInput />
        )}
      </div>

      {/* Right Info Panel — slides in */}
      {isInfoPanelOpen && activeConversation && (
        <ConversationInfoPanel />
      )}

      {/* Global Modals */}
      <ForwardModal />
    </div>
  );
};

export default ChatDesk;
