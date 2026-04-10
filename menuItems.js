const express = require('express');
const router = express.Router();
const mongodb = require('../database/connect');
const ObjectId = require('mongodb').ObjectId;

// GET all menu items
router.get('/', async (req, res) => {
  const result = await mongodb.getDb().db().collection('menuItems').find();
  result.toArray().then((menuItems) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(menuItems);
  });
});

// GET single menu item
router.get('/:id', async (req, res) => {
  const menuItemId = new ObjectId(req.params.id);
  const result = await mongodb.getDb().db().collection('menuItems').find({ _id: menuItemId });
  result.toArray().then((menuItem) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(menuItem[0]);
  });
});

// CREATE menu item
router.post('/', async (req, res) => {
  const menuItem = {
    name: req.body.name,
    price: req.body.price,
    category: req.body.category,
    description: req.body.description
  };
  const response = await mongodb.getDb().db().collection('menuItems').insertOne(menuItem);
  if (response.acknowledged) {
    res.status(201).json(response);
  } else {
    res.status(500).json(response.error || 'Error creating menu item');
  }
});

// UPDATE menu item
router.put('/:id', async (req, res) => {
  const menuItemId = new ObjectId(req.params.id);
  const menuItem = {
    name: req.body.name,
    price: req.body.price,
    category: req.body.category,
    description: req.body.description
  };
  const response = await mongodb.getDb().db().collection('menuItems').replaceOne({ _id: menuItemId }, menuItem);
  if (response.modifiedCount > 0) {
    res.status(204).send();
  } else {
    res.status(500).json(response.error || 'Error updating menu item');
  }
});

// DELETE menu item
router.delete('/:id', async (req, res) => {
  const menuItemId = new ObjectId(req.params.id);
  const response = await mongodb.getDb().db().collection('menuItems').deleteOne({ _id: menuItemId });
  if (response.deletedCount > 0) {
    res.status(204).send();
  } else {
    res.status(500).json(response.error || 'Error deleting menu item');
  }
});

module.exports = router;