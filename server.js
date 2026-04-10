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

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'supersecret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions'
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

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
      description: 'API for managing menu items, orders, users, and GitHub OAuth authentication'
    },
    servers: [
      {
        url: 'http://localhost:3000'
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

/**
 * @swagger
 * /menuItems:
 *   get:
 *     summary: Get all menu items
 *     description: Retrieves all menu items from the database.
 *     responses:
 *       200:
 *         description: A list of menu items
 *       500:
 *         description: Server error
 */
app.get('/menuItems', async (req, res) => {
  try {
    const db = mongodb.getDb();
    const result = await db.collection('menuItems').find().toArray();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /menuItems/{id}:
 *   get:
 *     summary: Get one menu item by ID
 *     description: Retrieves a single menu item by its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Menu item ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Menu item found
 *       400:
 *         description: Invalid menu item ID
 *       404:
 *         description: Menu item not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /menuItems:
 *   post:
 *     summary: Create a new menu item
 *     description: Protected route. Requires login.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: string
 *               available:
 *                 type: boolean
 *               createdAt:
 *                 type: string
 *             example:
 *               name: Grilled Chicken Plate
 *               description: Grilled chicken served with rice and vegetables
 *               price: 12.99
 *               category: Lunch
 *               ingredients: ["chicken", "rice", "vegetables"]
 *               available: true
 *               createdAt: 2026-04-07
 *     responses:
 *       201:
 *         description: Menu item created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /menuItems/{id}:
 *   put:
 *     summary: Update a menu item
 *     description: Protected route. Requires login.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Menu item ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: string
 *               available:
 *                 type: boolean
 *               createdAt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Menu item updated successfully
 *       400:
 *         description: Invalid ID or validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Menu item not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /menuItems/{id}:
 *   delete:
 *     summary: Delete a menu item
 *     description: Protected route. Requires login.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Menu item ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Menu item deleted successfully
 *       400:
 *         description: Invalid menu item ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Menu item not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all orders
 *     description: Retrieves all orders from the database.
 *     responses:
 *       200:
 *         description: A list of orders
 *       500:
 *         description: Server error
 */
app.get('/orders', async (req, res) => {
  try {
    const db = mongodb.getDb();
    const result = await db.collection('orders').find().toArray();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get one order by ID
 *     description: Retrieves a single order by its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Order ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order found
 *       400:
 *         description: Invalid order ID
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create a new order
 *     description: Protected route. Requires login.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerName:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: string
 *               total:
 *                 type: number
 *               status:
 *                 type: string
 *               orderType:
 *                 type: string
 *               createdAt:
 *                 type: string
 *             example:
 *               customerName: Sandra Rodriguez
 *               items: ["Grilled Chicken Plate", "Coke"]
 *               total: 15.99
 *               status: Pending
 *               orderType: Dine-In
 *               createdAt: 2026-04-07
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /orders/{id}:
 *   put:
 *     summary: Update an order
 *     description: Protected route. Requires login.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Order ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerName:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: string
 *               total:
 *                 type: number
 *               status:
 *                 type: string
 *               orderType:
 *                 type: string
 *               createdAt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order updated successfully
 *       400:
 *         description: Invalid ID or validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /orders/{id}:
 *   delete:
 *     summary: Delete an order
 *     description: Protected route. Requires login.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Order ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order deleted successfully
 *       400:
 *         description: Invalid order ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
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

app.use('/users', userRoutes);
app.use('/auth', authRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

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