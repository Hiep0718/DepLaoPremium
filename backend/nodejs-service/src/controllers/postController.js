import Post from '../models/Post.js';

// Get feed (all posts, sorted by newest)
export const getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: posts
    });
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy bảng tin' });
  }
};

// Create a new post
export const createPost = async (req, res) => {
  try {
    const { authorId, content, images } = req.body;

    if (!authorId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin người đăng' });
    }

    if (!content && (!images || images.length === 0)) {
      return res.status(400).json({ success: false, message: 'Bài viết không được để trống' });
    }

    const newPost = new Post({
      authorId,
      content,
      images: images || []
    });

    await newPost.save();

    res.status(201).json({
      success: true,
      data: newPost
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi đăng bài' });
  }
};

// Like/Unlike a post
export const toggleLike = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    const likeIndex = post.likes.indexOf(userId);
    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // Like
      post.likes.push(userId);
    }

    await post.save();

    res.status(200).json({
      success: true,
      data: post
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi thích bài viết' });
  }
};
