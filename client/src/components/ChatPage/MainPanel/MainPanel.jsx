import React, { Component } from 'react';
import MessageHeader from './MessageHeader';
import Message from './Message';
import MessageForm from './MessageForm';
import { connect } from 'react-redux';
import { setUserPosts } from '../../../redux/actions/chatRoom_action';
import Skeleton from '../../../commons/components/Skeleton';
import {
  getDatabase,
  ref,
  onChildAdded,
  onChildRemoved,
  child,
  off,
} from 'firebase/database';

export class MainPanel extends Component {
  messageEndRef = React.createRef();

  state = {
    messages: [],
    messagesRef: ref(getDatabase(), 'messages'),
    messagesLoading: true,
    searchTerm: '',
    searchResults: [],
    searchLoading: false,
    typingRef: ref(getDatabase(), 'typing'),
    typingUsers: [],
    listenerLists: [],
  };

  componentDidMount() {
    const { chatRoom } = this.props; //리덕스 store에 chatRoom 정보가 들어있음.

    if (chatRoom) {
      this.addMessagesListeners(chatRoom.id);
      this.addTypingListeners(chatRoom.id);
    }
  }

  componentDidUpdate() {
    if (this.messageEndRef) {
      this.messageEndRef.scrollIntoView({ behavior: 'smooth' });
    }
  }

  componentWillUnmount() {
    // ref(getDatabase(), "messages")
    off(this.state.messagesRef);
    this.removeListeners(this.state.listenerLists);
  }

  removeListeners = (listeners) => {
    listeners.forEach((listner) => {
      off(ref(getDatabase(), `messages/${listner.id}`), listner.event);
    });
  };

  addTypingListeners = (chatRoomId) => {
    let typingUsers = [];
    //typing이 새로 들어올 때
    let { typingRef } = this.state;

    onChildAdded(child(typingRef, chatRoomId), (DataSnapshot) => {
      // 현재 타이핑 중인 사람 !== 로그인한 사람
      if (DataSnapshot.key !== this.props.user.uid) {
        typingUsers = typingUsers.concat({
          id: DataSnapshot.key,
          name: DataSnapshot.val(),
        });
        this.setState({ typingUsers });
      }
    });

    //listenersList state에 등록된 리스너를 넣어주기
    this.addToListenerLists(chatRoomId, this.state.typingRef, 'child_added');

    //typing을 지워줄 때
    onChildRemoved(child(typingRef, chatRoomId), (DataSnapshot) => {
      const index = typingUsers.findIndex(
        (user) => user.id === DataSnapshot.key,
      );
      if (index !== -1) {
        typingUsers = typingUsers.filter(
          (user) => user.id !== DataSnapshot.key,
        );
        this.setState({ typingUsers });
      }
    });

    //listenersList state에 등록된 리스너를 넣어주기
    this.addToListenerLists(chatRoomId, this.state.typingRef, 'child_removed');
  };

  addToListenerLists = (id, ref, event) => {
    //이미 등록된 리스너인지 확인
    const index = this.state.listenerLists.findIndex((listener) => {
      return (
        listener.id === id && listener.ref === ref && listener.event === event
      );
    });

    if (index === -1) {
      const newListener = { id, ref, event };
      this.setState({
        listenerLists: this.state.listenerLists.concat(newListener),
      });
    }
  };

  handleSearchMessages = () => {
    const chatRoomMessages = [...this.state.messages];
    const regex = new RegExp(this.state.searchTerm, 'gi');
    const searchResults = chatRoomMessages.reduce((acc, message) => {
      if (
        (message.content && message.content.match(regex)) || // 텍스트 메시지 내용이 존재하고, 메시지 내용이 regexp(정규표현식)와 일치하거나 메시지 보낸 유저 네임과  regexp(정규표현식)가 일치되는 것이 있을 경우
        message.user.name.match(regex) // acc에 메시지를 push합니다. (계속 축적됨)
      ) {
        acc.push(message); // acc 리턴
      }
      return acc;
    }, []); //초깃값은 빈 배열
    this.setState({ searchResults });
  };

  handleSearchChange = (event) => {
    this.setState(
      {
        searchTerm: event.target.value,
        searchLoading: true,
      },
      () => this.handleSearchMessages(),
    );
  };

  addMessagesListeners = (chatRoomId) => {
    let messagesArray = [];

    let { messagesRef } = this.state;

    onChildAdded(child(messagesRef, chatRoomId), (DataSnapshot) => {
      messagesArray.push(DataSnapshot.val());
      this.setState({
        messages: messagesArray,
        messagesLoading: false,
      });
      this.userPostsCount(messagesArray);
    });
  };

  userPostsCount = (messages) => {
    let userPosts = messages.reduce((acc, message) => {
      if (message.user.name in acc) {
        acc[message.user.name].count += 1;
      } else {
        acc[message.user.name] = {
          image: message.user.image,
          count: 1,
        };
      }
      return acc;
    }, {});
    this.props.dispatch(setUserPosts(userPosts));
  };

  renderMessages = (messages) =>
    messages.length > 0 &&
    messages.map((message) => (
      // 여기서 수행할 경우 복잡해지므로 Message 컴포넌트에서 수행함
      <Message
        key={message.timestamp}
        message={message} // 타임스탬프 포함한 메시지 정보
        user={this.props.user} // 메시지가 내가 보낸 것인지, 다른사람이 보낸 것인지 구분하기 위한 것, mapStateToProps에서 받아온 state.user.currentUser 값임
      />
    ));

  renderTypingUsers = (typingUsers) => {
    return (
      typingUsers.length > 0 &&
      typingUsers.map((user) => (
        <span>{user.name.userUid}님이 채팅을 입력하고 있습니다...</span>
      ))
    );
  };

  renderMessageSkeleton = (loading) =>
    loading && (
      <>
        {[...Array(10)].map((v, i) => (
          <Skeleton key={i} />
        ))}
      </>
    );

  render() {
    const {
      messages,
      searchTerm,
      searchResults,
      typingUsers,
      messagesLoading,
    } = this.state;
    return (
      <div className="px-8 pt-8 p-0">
        <MessageHeader handleSearchChange={this.handleSearchChange} />

        <div className="w-full h-450 border-solid outline-2 border-slate-200 rounded p-4 mb-4 overflow-auto">
          {this.renderMessageSkeleton(messagesLoading)}

          {searchTerm
            ? this.renderMessages(searchResults)
            : this.renderMessages(messages)}
          {this.renderTypingUsers(typingUsers)}
          {/* 스크롤이 내려갈 자리, node는 div를 가리킴 */}
          <div ref={(node) => (this.messageEndRef = node)} />
        </div>

        <MessageForm />
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    user: state.user.currentUser,
    chatRoom: state.chatRoom.currentChatRoom,
  };
};

export default connect(mapStateToProps)(MainPanel); //리덕스 store에 chatRoom 정보가 들어있음.
