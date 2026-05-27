import mongoose from 'mongoose';

const storySchema = new mongoose.Schema({
  authorId: {
    type: String,
    required: true,
    index: true
  },
  mediaUrl: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    default: 'image'
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true // index for easy querying of active stories
  }
}, {
  timestamps: true
});

const Story = mongoose.model('Story', storySchema);
export default Story;
