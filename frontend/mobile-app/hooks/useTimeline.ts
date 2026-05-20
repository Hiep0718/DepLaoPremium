import { useState, useEffect, useCallback } from 'react';
import { timelineApiClient } from '@/constants/timelineApi';
import apiClient from '@/constants/api'; // For getting user info

export interface Post {
  _id: string;
  authorId: string;
  content: string;
  images: string[];
  likes: string[];
  comments: any[];
  createdAt: string;
  author?: {
    fullName: string;
    avatarUrl: string;
  };
}

export interface Story {
  _id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: string;
  expiresAt: string;
  createdAt: string;
  author?: {
    fullName: string;
    avatarUrl: string;
  };
}

export const useTimeline = (currentUserId: string | null) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingStories, setLoadingStories] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User cache to avoid duplicate API calls
  const [userCache, setUserCache] = useState<Record<string, { fullName: string; avatarUrl: string }>>({});

  const fetchUserInfo = async (userId: string) => {
    if (userCache[userId]) return userCache[userId];
    try {
      const res = await apiClient.get(`/users/${userId}`);
      if (res.data?.data) {
        const userInfo = {
          fullName: res.data.data.fullName || res.data.data.nickname || 'Người dùng',
          avatarUrl: res.data.data.avatarUrl || 'https://via.placeholder.com/150',
        };
        setUserCache(prev => ({ ...prev, [userId]: userInfo }));
        return userInfo;
      }
    } catch (err) {
      console.log('Error fetching user info for timeline', err);
    }
    return { fullName: 'Người dùng', avatarUrl: 'https://via.placeholder.com/150' };
  };

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const response = await timelineApiClient.get('/posts');
      if (response.data?.success) {
        const fetchedPosts: Post[] = response.data.data;
        
        // Populate author info
        const populatedPosts = await Promise.all(fetchedPosts.map(async (post) => {
          const author = await fetchUserInfo(post.authorId);
          return { ...post, author };
        }));

        setPosts(populatedPosts);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching posts');
    } finally {
      setLoadingPosts(false);
    }
  }, [userCache]);

  const fetchStories = useCallback(async () => {
    setLoadingStories(true);
    try {
      const response = await timelineApiClient.get('/stories');
      if (response.data?.success) {
        const fetchedStories: Story[] = response.data.data;

        // Populate author info
        const populatedStories = await Promise.all(fetchedStories.map(async (story) => {
          const author = await fetchUserInfo(story.authorId);
          return { ...story, author };
        }));

        setStories(populatedStories);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching stories');
    } finally {
      setLoadingStories(false);
    }
  }, [userCache]);

  const createPost = async (content: string, images: string[]) => {
    if (!currentUserId) return false;
    try {
      const response = await timelineApiClient.post('/posts', {
        authorId: currentUserId,
        content,
        images
      });
      if (response.data?.success) {
        // Refresh feed
        await fetchPosts();
        return true;
      }
      return false;
    } catch (err) {
      console.log('Error creating post', err);
      return false;
    }
  };

  const createStory = async (mediaUrl: string, mediaType: string = 'image') => {
    if (!currentUserId) return false;
    try {
      const response = await timelineApiClient.post('/stories', {
        authorId: currentUserId,
        mediaUrl,
        mediaType
      });
      if (response.data?.success) {
        // Refresh stories
        await fetchStories();
        return true;
      }
      return false;
    } catch (err) {
      console.log('Error creating story', err);
      return false;
    }
  };

  const toggleLike = async (postId: string) => {
    if (!currentUserId) return;
    
    // Optimistic UI update
    setPosts(prevPosts => prevPosts.map(post => {
      if (post._id === postId) {
        const isLiked = post.likes.includes(currentUserId);
        const newLikes = isLiked 
          ? post.likes.filter(id => id !== currentUserId)
          : [...post.likes, currentUserId];
        return { ...post, likes: newLikes };
      }
      return post;
    }));

    try {
      await timelineApiClient.post(`/posts/${postId}/like`, {
        userId: currentUserId
      });
    } catch (err) {
      console.log('Error toggling like', err);
      // Revert on error (could implement if needed)
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchStories();
  }, []);

  return {
    posts,
    stories,
    loadingPosts,
    loadingStories,
    error,
    refreshPosts: fetchPosts,
    refreshStories: fetchStories,
    createPost,
    createStory,
    toggleLike
  };
};
