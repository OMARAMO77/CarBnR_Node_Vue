const Location = require('../models/Location');
const City = require('../models/City');
const User = require('../models/User');

// Update handleErrors function
const handleErrors = (res, error, defaultMessage) => {
  console.error(error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: error.message });
  }
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return res.status(409).json({ 
      error: `${field} '${error.keyValue[field]}' already exists`
    });
  }
  res.status(500).json({ error: defaultMessage });
};
// Get all locations with filters
const getLocations = async (req, res) => {
  try {
    const { cityId, userId, deleted } = req.query;
    const query = {};
    
    if (cityId) query.cityId = cityId;
    if (userId) query.userId = userId;
    
    // Handle deleted filter
    if (deleted === 'true') {
      query.deleted = { $ne: null };
    } else if (deleted === 'false') {
      query.deleted = null;
    }

    const locations = await Location.find(query)
      .setOptions({ withDeleted: deleted === 'true' })
      .populate('city', 'name')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json(locations);
  } catch (err) {
    handleErrors(res, err, 'Failed to fetch locations');
  }
};

// Get single location
const getLocationById = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id)
      .populate('city', 'name')
      .populate('user', 'name email');

    if (!location) return res.status(404).json({ error: 'Location not found' });
    res.json(location);
  } catch (err) {
    handleErrors(res, err, 'Failed to fetch location');
  }
};

// Create location
const createLocation = async (req, res) => {
  try {
    const { name, address, phone_number, cityId, userId } = req.body;
    
    // Verify references exist
    const [city, user] = await Promise.all([
      City.findById(cityId),
      User.findById(userId)
    ]);
    
    if (!city) return res.status(400).json({ error: 'Invalid city' });
    if (!user) return res.status(400).json({ error: 'Invalid user' });

    const location = new Location({ name, address, phone_number, cityId, userId });
    await location.save();
    
    // Properly populate after save
    const populatedLocation = await Location.findById(location._id)
      .populate('city')
      .populate('user')
      .lean(); // Convert to plain object

    res.status(201).json(populatedLocation);
  } catch (err) {
    handleErrors(res, err, 'Failed to create location');
  }
};

// Update location
const updateLocation = async (req, res) => {
  try {
    const updates = req.body;
    
    // Verify references if updated
    if (updates.cityId) {
      const cityExists = await City.exists({ _id: updates.cityId });
      if (!cityExists) return res.status(400).json({ error: 'Invalid city' });
    }
    
    if (updates.userId) {
      const userExists = await User.exists({ _id: updates.userId });
      if (!userExists) return res.status(400).json({ error: 'Invalid user' });
    }

    const updatedLocation = await Location.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate(['city', 'user']);

    if (!updatedLocation) return res.status(404).json({ error: 'Location not found' });
    res.json(updatedLocation);
  } catch (err) {
    handleErrors(res, err, 'Failed to update location');
  }
};

// Add these new methods
const searchLocations = async (req, res) => {
  try {
    const { q } = req.query;
    const locations = await Location.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .populate('city user');

    res.json(locations);
  } catch (err) {
    handleErrors(res, err, 'Search failed');
  }
};

const softDeleteLocation = async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(
      req.params.id,
      { deleted: new Date() },
      { new: true }
    ).populate('city user');

    if (!location) return res.status(404).json({ error: 'Location not found' });
    res.json(location);
  } catch (err) {
    handleErrors(res, err, 'Delete failed');
  }
};

// Delete location
const deleteLocation = async (req, res) => {
  try {
    const deletedLocation = await Location.findByIdAndDelete(req.params.id);
    if (!deletedLocation) return res.status(404).json({ error: 'Location not found' });
    res.status(204).send();
  } catch (err) {
    handleErrors(res, err, 'Failed to delete location');
  }
};
// Add ownership middleware
const verifyOwnership = async (req, res, next) => {
  try {
    // Check authentication first
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Convert both to string for comparison
    if (location.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    next();
  } catch (err) {
    handleErrors(res, err, 'Authorization failed');
  }
};
module.exports = {
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  searchLocations,
  softDeleteLocation,
  verifyOwnership
};
