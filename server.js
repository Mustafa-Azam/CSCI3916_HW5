require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const authJwtController = require('./auth_jwt'); // You're not using authController, consider removing it
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./Users');
const Movie = require('./Movies');
const Review = require('./Reviews');
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

const router = express.Router();

// Removed getJSONObjectForMovieRequirement as it's not used

router.post('/signup', async (req, res) => { // Use async/await
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ success: false, msg: 'Please include both username and password to signup.' }); // 400 Bad Request
  }

  try {
    const user = new User({ // Create user directly with the data
      name: req.body.name,
      username: req.body.username,
      password: req.body.password,
    });

    await user.save(); // Use await with user.save()

    res.status(201).json({ success: true, msg: 'Successfully created new user.' }); // 201 Created
  } catch (err) {
    if (err.code === 11000) { // Strict equality check (===)
      return res.status(409).json({ success: false, message: 'A user with that username already exists.' }); // 409 Conflict
    } else {
      console.error(err); // Log the error for debugging
      return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
    }
  }
});


router.post('/signin', async (req, res) => { // Use async/await
  try {
    const user = await User.findOne({ username: req.body.username }).select('name username password');

    if (!user) {
      return res.status(401).json({ success: false, msg: 'Authentication failed. User not found.' }); // 401 Unauthorized
    }

    const isMatch = await user.comparePassword(req.body.password); // Use await

    if (isMatch) {
      const userToken = { id: user._id, username: user.username }; // Use user._id (standard Mongoose)
      const token = jwt.sign(userToken, process.env.SECRET_KEY, { expiresIn: '1h' }); // Add expiry to the token (e.g., 1 hour)
      res.json({ success: true, token: 'JWT ' + token });
    } else {
      res.status(401).json({ success: false, msg: 'Authentication failed. Incorrect password.' }); // 401 Unauthorized
    }
  } catch (err) {
    console.error(err); // Log the error
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
  }
});

router.route('/reviews') 
  .get(authJwtController.isAuthenticated, async(req, res) => {
    try {
      const reviews = await Review.find({});
      return res.json(reviews);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Error getting reviews',
        error: err.message
      })
    }
  })
  .post(authJwtController.isAuthenticated, async(req, res) => {
    /*
    const reviewSchema = new mongoose.Schema({
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie' },
    username: { type: String, required: true },
    review: { type: String, required: true },
    rating: { type: Number, min: 0, max: 5 }
  });
    */
    try {
      // Validate required fields
      const requiredFields = ['movieId', 'review', 'rating'];
      const missingFields = requiredFields.filter(field => !req.body[field]);
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`
        });
      }
      
      const review = new Review({
        movieId: req.body.movieId,
        username: req.user.username,
        review: req.body.review,
        rating: req.body.rating
      });
      await review.save();
      return res.status(201).json({
        success: true,
        message: 'Review created!',
        movieId: review.movieId,
        review: review
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'A review with that ID already exists'
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error creating review',
        error: err.message
      });
    }
  });

router.route('/movies')
  .get(authJwtController.isAuthenticated, async (req, res) => {
    try {
      if (req.query.reviews === "true") {
        const movies = await Movie.aggregate([
          {
            $lookup: {
              from: "reviews",
              localField: "_id",
              foreignField: "movieId",
              as: "reviews"
            }
          },
          {
            $addFields: {
              avgRating: {
                $cond: {
                  if: { $gt: [ { $size: "$reviews" }, 0 ] },
                  then: { $avg: "$reviews.rating" },
                  else: null
                }
              }
            }
          },
          {
            $sort: {
              avgRating: -1,
              title: 1,
            },
          },
        ]);

        return res.json(movies);
      } else {
        const movies = await Movie.find().sort({ title: 1 });
        return res.json(movies);
      }
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Error getting movies',
        error: err.message,
      });
    }
  })
  .post(authJwtController.isAuthenticated, async (req, res) => {
    try {
      const movie = new Movie({
        title: req.body.title,
        releaseDate: req.body.releaseDate,
        genre: req.body.genre,
        actors: req.body.actors,
        imageUrl: req.body.imageUrl,
      });
      await movie.save();
      return res.status(201).json({
        success: true,
        message: 'Movie created!',
        movie: movie
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Error creating movie',
        error: err.message,
      });
    }
  });

router.get(
  '/movies/movieId/:movieId',
  authJwtController.isAuthenticated,
  async (req, res) => {
    try {
      const { movieId } = req.params;
      if (!/^[a-fA-F0-9]{24}$/.test(movieId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid movie id; expected a 24-character id.',
        });
      }

      if (req.query.reviews === 'true' || req.query.reviews === true) {
        const oid = new mongoose.Types.ObjectId(movieId);
        const results = await Movie.aggregate([
          { $match: { _id: oid } },
          {
            $lookup: {
              from: 'reviews',
              localField: '_id',
              foreignField: 'movieId',
              as: 'reviews',
            },
          },
          {
            $addFields: {
              avgRating: {
                $cond: {
                  if: { $gt: [{ $size: '$reviews' }, 0] },
                  then: { $avg: '$reviews.rating' },
                  else: null,
                },
              },
            },
          },
          { $limit: 1 },
        ]);

        const movie = results[0];
        if (!movie) {
          return res.status(404).json({ success: false, message: 'Movie not found' });
        }
        return res.status(200).json(movie);
      }

      const movie = await Movie.findById(movieId);
      if (!movie) {
        return res.status(404).json({ success: false, message: 'Movie not found' });
      }

      return res.status(200).json(movie);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Error getting movie' });
    }
  }
);

router.get('/movies/:movieparameter', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const movie = await Movie.findOne({ title: req.params.movieparameter });

    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }

    return res.status(200).json(movie);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error getting movie' });
  }
});

router.put('/movies/:movieparameter', authJwtController.isAuthenticated, async (req, res) => {
  try {
    if (req.body.actors && req.body.actors.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Movie must include at least one actor.'
      });
    }

    const updatedMovie = await Movie.findOneAndUpdate(
      { title: req.params.movieparameter },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedMovie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }

    return res.status(200).json(updatedMovie);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error updating movie' });
  }
});

router.delete('/movies/:movieparameter', authJwtController.isAuthenticated, async (req, res) => {
  try {
    const deletedMovie = await Movie.findOneAndDelete({ title: req.params.movieparameter });

    if (!deletedMovie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }

    return res.status(200).json({ success: true, message: 'Movie deleted successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error deleting movie' });
  }
});

app.use('/', router);

const PORT = process.env.PORT || 8080; // Define PORT before using it
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // for testing only