const Car = require('../models/Car');
const Location = require('../models/Location');

const handleErrors = (res, error, defaultMessage) => {
  console.error(error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ error: 'Registration number already exists' });
  }
  res.status(500).json({ error: defaultMessage });
};

// Get all cars with filters
const getCars = async (req, res) => {
  try {
    const { locationId, available, minPrice, maxPrice, brand } = req.query;
    const query = {};
    
    if (locationId) query.locationId = locationId;
    if (available) query.available = available === 'true';
    if (minPrice || maxPrice) {
      query.priceByDay = {};
      if (minPrice) query.priceByDay.$gte = minPrice;
      if (maxPrice) query.priceByDay.$lte = maxPrice;
    }
    if (brand) query.brand = new RegExp(brand, 'i');

    const cars = await Car.find(query)
      .populate('location', 'name address')
      .sort({ priceByDay: 1 });

    res.json(cars);
  } catch (err) {
    handleErrors(res, err, 'Failed to fetch cars');
  }
};

// Get single car
const getCarById = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id).populate('location');
    if (!car) return res.status(404).json({ error: 'Car not found' });
    res.json(car);
  } catch (err) {
    handleErrors(res, err, 'Failed to fetch car');
  }
};

// Create car
const createCar = async (req, res) => {
  try {
    const { locationId, registrationNumber } = req.body;
    
    // Validate location exists
    const location = await Location.findById(locationId);
    if (!location) return res.status(400).json({ error: 'Invalid location' });

    const car = new Car(req.body);
    await car.save();
    
    res.status(201).json(await car.populate('location'));
  } catch (err) {
    handleErrors(res, err, 'Failed to create car');
  }
};

// Update car
const updateCar = async (req, res) => {
  try {
    const updates = req.body;
    
    if (updates.locationId) {
      const location = await Location.findById(updates.locationId);
      if (!location) return res.status(400).json({ error: 'Invalid location' });
    }

    const updatedCar = await Car.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('location');

    if (!updatedCar) return res.status(404).json({ error: 'Car not found' });
    res.json(updatedCar);
  } catch (err) {
    handleErrors(res, err, 'Failed to update car');
  }
};

// Delete car
const deleteCar = async (req, res) => {
  try {
    const deletedCar = await Car.findByIdAndDelete(req.params.id);
    if (!deletedCar) return res.status(404).json({ error: 'Car not found' });
    res.status(204).send();
  } catch (err) {
    handleErrors(res, err, 'Failed to delete car');
  }
};

module.exports = {
  getCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar
};
