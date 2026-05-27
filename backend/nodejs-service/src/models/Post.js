import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  authorId: {
    type: String,
    required: true,
    index: true
  },
  content: {
    type: String,
    default: ''
  },
  images: [{
    type: String
  }],
  likes: [{
    type: String // user IDs
  }],
  comments: [{
    userId: String,
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

const Post = mongoose.model('Post', postSchema);
export default Post;
