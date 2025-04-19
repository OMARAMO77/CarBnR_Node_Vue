const City = require('../models/City');
const State = require('../models/State');

const handleErrors = (res, error, defaultMessage) => {
  console.error(error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ error: 'City already exists in this state' });
  }
  res.status(500).json({ error: defaultMessage });
};

// Get all cities (filterable by state)
const getCities = async (req, res) => {
  try {
    const { stateId, search } = req.query;
    const query = {};
    
    if (stateId) {
      // Validate state exists first
      const stateExists = await State.exists({ _id: stateId });
      if (!stateExists) return res.json([]);
      
      query.stateId = stateId;
    }
    if (search) query.name = { $regex: search, $options: 'i' };

    const cities = await City.find(query)
      .populate({
        path: 'state',
        select: 'id name' // Explicitly select fields
      })
      .sort({ name: 1 })
      .catch(err => {
        console.error('Query error:', err);
        return [];
      });

    res.json(cities);
  } catch (err) {
    handleErrors(res, err, 'Failed to fetch cities');
  }
};

// Get single city
const getCityById = async (req, res) => {
  try {
    const city = await City.findById(req.params.id).populate('state', 'name');
    if (!city) return res.status(404).json({ error: 'City not found' });
    res.json(city);
  } catch (err) {
    handleErrors(res, err, 'Failed to fetch city');
  }
};

// Create city
const createCity = async (req, res) => {
  try {
    const { name, stateId } = req.body;
    
    // Manual state existence check
    const stateExists = await State.exists({ _id: stateId });
    if (!stateExists) return res.status(400).json({ error: 'Invalid state' });

    const city = new City({ name, stateId });
    await city.save();

    const populatedCity = await City.findById(city._id).populate('state');
    res.status(201).json(populatedCity);
  } catch (err) {
    handleErrors(res, err, 'Failed to create city');
  }
};

// Update city
const updateCity = async (req, res) => {
  try {
    // Validate request body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const updates = req.body;

    // Validate allowed fields
    const allowedUpdates = ['name', 'stateId'];
    const isValidOperation = Object.keys(updates).every(update => 
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).json({ error: 'Invalid updates!' });
    }

    if (updates.stateId) {
      const stateExists = await State.exists({ _id: updates.stateId });
      if (!stateExists) return res.status(400).json({ error: 'Invalid state' });
    }

    const updatedCity = await City.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('state', 'name');

    if (!updatedCity) return res.status(404).json({ error: 'City not found' });
    res.json(updatedCity);
  } catch (err) {
    handleErrors(res, err, 'Failed to update city');
  }
};

// Delete city
const deleteCity = async (req, res) => {
  try {
    const deletedCity = await City.findByIdAndDelete(req.params.id);
    if (!deletedCity) return res.status(404).json({ error: 'City not found' });
    res.status(204).send();
  } catch (err) {
    handleErrors(res, err, 'Failed to delete city');
  }
};

module.exports = {
  getCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity
};
