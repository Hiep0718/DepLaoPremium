import ChatHeader from '../components/chat/ChatHeader';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';

const ChatDesk = () => {
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50">
      <ChatHeader />
      <MessageList />
      <MessageInput />
    </div>
  );
};

export default ChatDesk;
