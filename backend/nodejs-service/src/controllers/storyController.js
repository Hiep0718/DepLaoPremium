import Story from '../models/Story.js';

// Get active stories
export const getActiveStories = async (req, res) => {
  try {
    const now = new Date();
    const stories = await Story.find({
      expiresAt: { $gt: now }
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: stories
    });
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy story' });
  }
};

// Create a new story
export const createStory = async (req, res) => {
  try {
    const { authorId, mediaUrl, mediaType } = req.body;

    if (!authorId || !mediaUrl) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin người đăng hoặc hình ảnh/video' });
    }

    // Set expiresAt to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const newStory = new Story({
      authorId,
      mediaUrl,
      mediaType: mediaType || 'image',
      expiresAt
    });

    await newStory.save();

    res.status(201).json({
      success: true,
      data: newStory
    });
  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi đăng story' });
  }
};
