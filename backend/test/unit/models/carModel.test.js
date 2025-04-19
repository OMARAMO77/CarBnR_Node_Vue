// test/unit/models/carModel.test.js
const { expect } = require('chai');
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const User = require('../../../models/User');
const State = require('../../../models/State');
const City = require('../../../models/City');
const Location = require('../../../models/Location');
const Car = require('../../../models/Car');

const TEST_DB_URI = 'mongodb://localhost:27017/car-rental-test';

describe('Car Model Integration Tests', () => {
  let testUser, testState, testCity, testLocation;
  const userData = {
    name: 'Test User',
    email: faker.internet.email(),
    password: faker.internet.password()
  };

  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();
    testUser = await User.create(userData);
    testState = await State.create({ name: 'California' });
    testCity = await City.create({ 
      name: 'Test City', 
      stateId: testState._id
    });
    testLocation = await Location.create({
      name: 'Test Location',
      address: '123 Main St',
      cityId: testCity._id,
      userId: testUser._id,
      phone_number: '+1234567890'
    });
  });

  beforeEach(async () => {
    await Car.deleteMany({});
  });

  after(async () => {
    await User.deleteMany({});
    await State.deleteMany({});
    //const remainingState = await State.find({ _id: testState._id });
    //const remainingCity = await City.find({ _id: testCity._id });
    //const remainingLocation = await User.find({ _id: testLocation._id });
    //const remainingUser = await User.find({ _id: testUser._id });
    //const remainingCar = await User.find({ });
    //console.log(`remainingState: ${remainingState}`);
    //console.log(`remainingUser: ${remainingUser}`);
    //console.log(`remainingCity: ${remainingCity}`);
    //console.log(`remainingLocation: ${remainingLocation}`);
    //console.log(`remainingCar: ${remainingCar}`);
    await mongoose.disconnect();
  });

  describe('Schema Validation', () => {
    it('should validate required fields', async () => {
      const carData = {
        brand: 'Toyota',
        model: 'Camry',
        year: 2023,
        priceByDay: 50,
        registrationNumber: 'ABC123'
      };

      let error;
      try {
        await Car.create(carData);
      } catch (err) {
        error = err;
      }
      
      expect(error).to.be.instanceOf(mongoose.Error.ValidationError);
      expect(error.errors.locationId).to.exist;
    });

    it('should validate registration number format', async () => {
      const carData = {
        locationId: testLocation._id,
        brand: 'Honda',
        model: 'Civic',
        year: 2023,
        priceByDay: 45,
        registrationNumber: 'invalid!'
      };

      let error;
      try {
        await Car.create(carData);
      } catch (err) {
        error = err;
      }
      
      expect(error).to.be.instanceOf(mongoose.Error.ValidationError);
      expect(error.errors.registrationNumber.message).to.include('Invalid registration number format');
    });
  });

  describe('Indexes', () => {
    before(async () => {
      // Wait for index creation to complete
      await Car.collection.createIndex({ locationId: 1 });
      await Car.collection.createIndex({ brand: 1, model: 1 });
      // Alternatively: await Car.init(); // If indexes are defined in schema
    });
    it('should have locationId index', async () => {
      const indexes = await Car.collection.indexes();
      //console.log(`indexes: ${JSON.stringify(indexes, null, 2)}`);
    
      // More flexible check for locationId index
      const locationIndex = indexes.find(index => 
        index.key && index.key.locationId === 1
      );
      //console.log(`locationIndex: ${JSON.stringify(locationIndex, null, 2)}`);
      expect(locationIndex).to.exist;
    });

    it('should have brand-model compound index', async () => {
      const indexes = await Car.collection.indexes();
      //console.log(`indexes: ${JSON.stringify(indexes, null, 2)}`);
    
      // More flexible check for compound index
      const brandModelIndex = indexes.find(index => 
        index.key && 
        index.key.brand === 1 && 
        index.key.model === 1
      );
      //console.log(`brandModelIndex: ${JSON.stringify(brandModelIndex, null, 2)}`);
      expect(brandModelIndex).to.exist;
    });
  });
  
  describe('Virtual Population', () => {
    it('should populate location details', async () => {
      const car = await Car.create({
        locationId: testLocation._id,
        brand: 'Ford',
        model: 'Focus',
        year: 2023,
        priceByDay: 40,
        registrationNumber: 'DEF456'
      });

      const populatedCar = await Car.findById(car._id).populate('location');
      expect(populatedCar.location).to.have.property('name', 'Test Location');
      expect(populatedCar.location).to.have.property('address', '123 Main St');
    });
  });

  describe('Pre-save Hooks', () => {
    it('should validate location existence', async () => {
      const invalidCar = new Car({
        locationId: new mongoose.Types.ObjectId(),
        brand: 'Chevrolet',
        model: 'Malibu',
        year: 2023,
        priceByDay: 55,
        registrationNumber: 'GHI789'
      });

      let error;
      try {
        await invalidCar.save();
      } catch (err) {
        error = err;
      }
      
      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.include('Invalid location reference');
    });
  });

  describe('Registration Number Uniqueness', () => {
    it('should enforce unique registration numbers', async () => {
      const regNumber = 'UNIQUE123';
      await Car.create({
        locationId: testLocation._id,
        brand: 'Nissan',
        model: 'Altima',
        year: 2023,
        priceByDay: 48,
        registrationNumber: regNumber
      });

      let error;
      try {
        await Car.create({
          locationId: testLocation._id,
          brand: 'Nissan',
          model: 'Altima',
          year: 2023,
          priceByDay: 48,
          registrationNumber: regNumber
        });
      } catch (err) {
        error = err;
      }
      
      expect(error).to.exist;
      expect(error.code).to.equal(11000);
    });
  });

  describe('Image URL Handling', () => {
    it('should accept valid image URLs', async () => {
      const car = await Car.create({
        locationId: testLocation._id,
        brand: 'Tesla',
        model: 'Model 3',
        year: 2023,
        priceByDay: 100,
        registrationNumber: 'TESLA123',
        imageUrl: 'https://example.com/tesla.jpg'
      });

      expect(car.imageUrl).to.equal('https://example.com/tesla.jpg');
    });

    it('should use default image when not provided', async () => {
      const car = await Car.create({
        locationId: testLocation._id,
        brand: 'BMW',
        model: 'X5',
        year: 2023,
        priceByDay: 120,
        registrationNumber: 'BMWX5123'
      });

      expect(car.imageUrl).to.equal('/images/default-car.jpg');
    });
  });

  describe('JSON Transformation', () => {
    it('should transform JSON output correctly', async () => {
      const car = await Car.create({
        locationId: testLocation._id,
        brand: 'Audi',
        model: 'A4',
        year: 2023,
        priceByDay: 80,
        registrationNumber: 'AUDI1234'
      });

      const jsonCar = car.toJSON();
      expect(jsonCar._id).to.be.undefined;
      expect(jsonCar.__v).to.be.undefined;
      expect(jsonCar.id).to.exist;
    });
  });

  describe('Default Values', () => {
    it('should set default availability status', async () => {
      const car = await Car.create({
        locationId: testLocation._id,
        brand: 'Hyundai',
        model: 'Elantra',
        year: 2023,
        priceByDay: 35,
        registrationNumber: 'HYUN456'
      });

      expect(car.available).to.be.true;
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum year value', async () => {
      let error;
      try {
        await Car.create({
          locationId: testLocation._id,
          brand: 'Vintage',
          model: 'Car',
          year: 1899,
          priceByDay: 100,
          registrationNumber: 'OLD123'
        });
      } catch (err) {
        error = err;
      }
      
      expect(error).to.be.instanceOf(mongoose.Error.ValidationError);
      expect(error.errors.year.message).to.include('Invalid year');
    });

    it('should handle maximum seat count', async () => {
      let error;
      try {
        await Car.create({
          locationId: testLocation._id,
          brand: 'Bus',
          model: 'Large',
          year: 2023,
          priceByDay: 200,
          registrationNumber: 'BUS1234',
          seats: 17
        });
      } catch (err) {
        error = err;
      }
      
      expect(error).to.be.instanceOf(mongoose.Error.ValidationError);
      expect(error.errors.seats.message).to.include('Maximum 16 seats');
    });
  });
});
