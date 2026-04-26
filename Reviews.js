const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1); // Exit the process if the connection fails (optional)
  }
};

connectDB();

// Review schema
var ReviewSchema = new mongoose.Schema({
  movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie' },
  username: { type: String, required: true },
  review: String,
  rating: { type: Number, min: [1, 'Must be greater than 0'], max: [5, 'Must be less than 6'] }
});

ReviewSchema.index({ movieId: 1, username: 1 }, { unique: true });
module.exports = mongoose.model('Review', ReviewSchema);