const express = require('express');
require('dotenv').config();

const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;

const mongodb = require('./database/connect');
const ObjectId = require('mongodb').ObjectId;
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const { isAuthenticated } = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24
  }
};

if (process.env.NODE_ENV !== 'test') {
  sessionConfig.store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions'
  });
}

app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const db = mongodb.getDb();
        const usersCollection = db.collection('oauth_users');

        let user = await usersCollection.findOne({ githubId: profile.id });

        if (!user) {
          user = {
            githubId: profile.id,
            username: profile.username || '',
            displayName: profile.displayName || '',
            profileUrl: profile.profileUrl || '',
            createdAt: new Date().toISOString()
          };

          const result = await usersCollection.insertOne(user);
          user._id = result.insertedId;
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.githubId);
});

passport.deserializeUser(async (githubId, done) => {
  try {
    const db = mongodb.getDb();
    const user = await db.collection('oauth_users').findOne({ githubId });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Restaurant API',
      version: '1.0.0',
      description: 'API for managing menu items, orders, customers, reviews, users, and GitHub OAuth authentication'
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === 'production'
            ? 'https://restaurant-api-dg7p.onrender.com'
            : 'http://localhost:3000'
      }
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid'
        }
      }
    }
  },
  apis: ['./server.js', './routes/*.js']
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

function validateMenuItem(menuItem) {
  const errors = [];

  if (!menuItem.name || typeof menuItem.name !== 'string' || menuItem.name.trim() === '') {
    errors.push('Name is required and must be a string.');
  }

  if (!menuItem.description || typeof menuItem.description !== 'string' || menuItem.description.trim() === '') {
    errors.push('Description is required and must be a string.');
  }

  if (menuItem.price === undefined || typeof menuItem.price !== 'number') {
    errors.push('Price is required and must be a number.');
  }

  if (!menuItem.category || typeof menuItem.category !== 'string' || menuItem.category.trim() === '') {
    errors.push('Category is required and must be a string.');
  }

  if (!Array.isArray(menuItem.ingredients)) {
    errors.push('Ingredients is required and must be an array.');
  }

  if (typeof menuItem.available !== 'boolean') {
    errors.push('Available is required and must be true or false.');
  }

  if (!menuItem.createdAt || typeof menuItem.createdAt !== 'string' || menuItem.createdAt.trim() === '') {
    errors.push('CreatedAt is required and must be a string.');
  }

  return errors;
}

function validateOrder(order) {
  const errors = [];

  if (!order.customerName || typeof order.customerName !== 'string' || order.customerName.trim() === '') {
    errors.push('Customer name is required and must be a string.');
  }

  if (!Array.isArray(order.items) || order.items.length === 0) {
    errors.push('Items is required and must be a non-empty array.');
  }

  if (order.total === undefined || typeof order.total !== 'number') {
    errors.push('Total is required and must be a number.');
  }

  if (!order.status || typeof order.status !== 'string' || order.status.trim() === '') {
    errors.push('Status is required and must be a string.');
  }

  if (!order.orderType || typeof order.orderType !== 'string' || order.orderType.trim() === '') {
    errors.push('Order type is required and must be a string.');
  }

  if (!order.createdAt || typeof order.createdAt !== 'string' || order.createdAt.trim() === '') {
    errors.push('CreatedAt is required and must be a string.');
  }

  return errors;
}

function validateCustomer(customer) {
  const errors = [];

  if (!customer.firstName || typeof customer.firstName !== 'string' || customer.firstName.trim() === '') {
    errors.push('First name is required and must be a string.');
  }

  if (!customer.lastName || typeof customer.lastName !== 'string' || customer.lastName.trim() === '') {
    errors.push('Last name is required and must be a string.');
  }

  if (!customer.email || typeof customer.email !== 'string' || customer.email.trim() === '') {
    errors.push('Email is required and must be a string.');
  }

  if (!customer.phone || typeof customer.phone !== 'string' || customer.phone.trim() === '') {
    errors.push('Phone is required and must be a string.');
  }

  if (!customer.loyaltyLevel || typeof customer.loyaltyLevel !== 'string' || customer.loyaltyLevel.trim() === '') {
    errors.push('Loyalty level is required and must be a string.');
  }

  if (typeof customer.active !== 'boolean') {
    errors.push('Active is required and must be true or false.');
  }

  if (!customer.createdAt || typeof customer.createdAt !== 'string' || customer.createdAt.trim() === '') {
    errors.push('CreatedAt is required and must be a string.');
  }

  return errors;
}

function validateReview(review) {
  const errors = [];

  if (!review.customerName || typeof review.customerName !== 'string' || review.customerName.trim() === '') {
    errors.push('Customer name is required and must be a string.');
  }

  if (!review.menuItem || typeof review.menuItem !== 'string' || review.menuItem.trim() === '') {
    errors.push('Menu item is required and must be a string.');
  }

  if (review.rating === undefined || typeof review.rating !== 'number') {
    errors.push('Rating is required and must be a number.');
  }

  if (!review.comment || typeof review.comment !== 'string' || review.comment.trim() === '') {
    errors.push('Comment is required and must be a string.');
  }

  if (typeof review.approved !== 'boolean') {
    errors.push('Approved is required and must be true or false.');
  }

  if (!review.createdAt || typeof review.createdAt !== 'string' || review.createdAt.trim() === '') {
    errors.push('CreatedAt is required and must be a string.');
  }

  return errors;
}

/**
 * @swagger
 * /:
 *   get:
 *     summary: Test route
 *     description: Returns a simple message to confirm the API is running.
 *     responses:
 *       200:
 *         description: API is running successfully
 */
app.get('/', (req, res) => {
  res.send('Restaurant API is running');
});

app.get('/menuItems', async (req, res) => {
  try {
    const db = mongodb.getDb();
    const result = await db.collection('menuItems').find().toArray();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/menuItems/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid menu item ID' });
    }

    const db = mongodb.getDb();
    const menuItemId = new ObjectId(req.params.id);
    const result = await db.collection('menuItems').findOne({ _id: menuItemId });

    if (!result) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/menuItems', isAuthenticated, async (req, res) => {
  try {
    const menuItem = req.body;
    const errors = validateMenuItem(menuItem);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const db = mongodb.getDb();
    const result = await db.collection('menuItems').insertOne(menuItem);

    res.status(201).json({
      message: 'Menu item created successfully',
      insertedId: result.insertedId
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/menuItems/:id', isAuthenticated, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid menu item ID' });
    }

    const updatedMenuItem = req.body;
    const errors = validateMenuItem(updatedMenuItem);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const db = mongodb.getDb();
    const menuItemId = new ObjectId(req.params.id);

    const result = await db.collection('menuItems').replaceOne(
      { _id: menuItemId },
      updatedMenuItem
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    res.status(200).json({ message: 'Menu item updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/menuItems/:id', isAuthenticated, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid menu item ID' });
    }

    const db = mongodb.getDb();
    const menuItemId = new ObjectId(req.params.id);
    const result = await db.collection('menuItems').deleteOne({ _id: menuItemId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    res.status(200).json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/orders', async (req, res) => {
  try {
    const db = mongodb.getDb();
    const result = await db.collection('orders').find().toArray();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/orders/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const db = mongodb.getDb();
    const orderId = new ObjectId(req.params.id);
    const result = await db.collection('orders').findOne({ _id: orderId });

    if (!result) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/orders', isAuthenticated, async (req, res) => {
  try {
    const order = req.body;
    const errors = validateOrder(order);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const db = mongodb.getDb();
    const result = await db.collection('orders').insertOne(order);

    res.status(201).json({
      message: 'Order created successfully',
      insertedId: result.insertedId
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/orders/:id', isAuthenticated, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const updatedOrder = req.body;
    const errors = validateOrder(updatedOrder);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const db = mongodb.getDb();
    const orderId = new ObjectId(req.params.id);

    const result = await db.collection('orders').replaceOne(
      { _id: orderId },
      updatedOrder
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({ message: 'Order updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/orders/:id', isAuthenticated, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const db = mongodb.getDb();
    const orderId = new ObjectId(req.params.id);
    const result = await db.collection('orders').deleteOne({ _id: orderId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/customers', async (req, res) => {
  try {
    const db = mongodb.getDb();
    const result = await db.collection('customers').find().toArray();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/customers/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }

    const db = mongodb.getDb();
    const customerId = new ObjectId(req.params.id);
    const result = await db.collection('customers').findOne({ _id: customerId });

    if (!result) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/customers', isAuthenticated, async (req, res) => {
  try {
    const customer = req.body;
    const errors = validateCustomer(customer);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const db = mongodb.getDb();
    const result = await db.collection('customers').insertOne(customer);

    res.status(201).json({
      message: 'Customer created successfully',
      insertedId: result.insertedId
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/customers/:id', isAuthenticated, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }

    const updatedCustomer = req.body;
    const errors = validateCustomer(updatedCustomer);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const db = mongodb.getDb();
    const customerId = new ObjectId(req.params.id);

    const result = await db.collection('customers').replaceOne(
      { _id: customerId },
      updatedCustomer
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(200).json({ message: 'Customer updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/customers/:id', isAuthenticated, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }

    const db = mongodb.getDb();
    const customerId = new ObjectId(req.params.id);
    const result = await db.collection('customers').deleteOne({ _id: customerId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(200).json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/reviews', async (req, res) => {
  try {
    const db = mongodb.getDb();
    const result = await db.collection('reviews').find().toArray();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/reviews/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const db = mongodb.getDb();
    const reviewId = new ObjectId(req.params.id);
    const result = await db.collection('reviews').findOne({ _id: reviewId });

    if (!result) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/reviews', isAuthenticated, async (req, res) => {
  try {
    const review = req.body;
    const errors = validateReview(review);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const db = mongodb.getDb();
    const result = await db.collection('reviews').insertOne(review);

    res.status(201).json({
      message: 'Review created successfully',
      insertedId: result.insertedId
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/reviews/:id', isAuthenticated, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const updatedReview = req.body;
    const errors = validateReview(updatedReview);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const db = mongodb.getDb();
    const reviewId = new ObjectId(req.params.id);

    const result = await db.collection('reviews').replaceOne(
      { _id: reviewId },
      updatedReview
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.status(200).json({ message: 'Review updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/reviews/:id', isAuthenticated, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const db = mongodb.getDb();
    const reviewId = new ObjectId(req.params.id);
    const result = await db.collection('reviews').deleteOne({ _id: reviewId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.use('/users', userRoutes);
app.use('/auth', authRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'test') {
  mongodb.initDb((err) => {
    if (err) {
      console.error('Error connecting to DB:', err);
    } else {
      console.log('Connected to MongoDB');
      app.listen(port, () => {
        console.log(`Server running on port ${port}`);
      });
    }
  });
}

module.exports = app;