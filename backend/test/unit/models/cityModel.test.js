// test/unit/models/cityModel.test.js
const { expect } = require('chai');
const { faker } = require('@faker-js/faker');
const mongoose = require('mongoose');
const User = require('../../../models/User');
const State = require('../../../models/State');
const City = require('../../../models/City');
const Location = require('../../../models/Location');

const TEST_DB_URI = 'mongodb://localhost:27017/car-rental-test';

describe('City Model Integration Tests', () => {
  let testUser, testState, testState2;
  const userData = {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password()
  };

  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();
    testUser = await User.create(userData);
    testState = await State.create({ name: 'California' });
  });

  beforeEach(async () => {
    await City.deleteMany({});
    await Location.deleteMany({});
  });

  after(async () => {
    await User.deleteMany({});
    await State.deleteMany({});
    //const remainingState = await State.find({ _id: testState._id });
    //const remainingUser = await User.find({ _id: testUser._id });
    //console.log(`remainingState: ${remainingState}`);
    //console.log(`remainingUser: ${remainingUser}`);
    await mongoose.disconnect();
  });

  describe('Schema Validation', () => {
    it('should enforce required fields', async () => {
      const city = new City({});
      let error;

      try {
        await city.save();
      } catch (err) {
        error = err;
      }

      expect(error).to.be.an.instanceOf(mongoose.Error.ValidationError);
      expect(error.errors.name).to.exist;
      expect(error.errors.stateId).to.exist;
    });
	

    it('should reject city name shorter than 2 characters', async () => {
      const city = new City({ name: 'A' });
      
      try {
        await city.save();
        throw new Error('Should have failed');
      } catch (err) {
        expect(err).to.be.instanceOf(mongoose.Error.ValidationError);
        expect(err.errors.name).to.exist;
      }
    });

    it('should reject city name longer than 50 characters', async () => {
      const longName = 'A'.repeat(101);
      const city = new City({ name: longName });
      
      try {
        await city.save();
        throw new Error('Should have failed');
      } catch (err) {
        expect(err).to.be.instanceOf(mongoose.Error.ValidationError);
        expect(err.errors.name).to.exist;
      }
    });

    it('should normalize city name capitalization', async () => {
      const city = await City.create({ 
        name: 'san francisco', 
        stateId: testState._id 
      });
      expect(city.name).to.equal('San Francisco');
    });

    it('should validate stateId reference', async () => {
      const invalidCity = new City({
        name: 'Invalid State City',
        stateId: new mongoose.Types.ObjectId()
      });

      let error;
      try {
        await invalidCity.save();
      } catch (err) {
        error = err;
      }

      expect(error).to.exist;
      expect(error.message).to.include('Invalid state reference');
    });
  });

  describe('Indexes and Virtuals', () => {
    it('should have compound unique index for stateId and name', async () => {
      const city = await City.create({ name: 'Los Angeles', stateId: testState._id });
      const duplicateCity = new City({ 
        name: 'Los Angeles', 
        stateId: testState._id 
      });
      try {
        await duplicateCity.save();
        console.log(`city: ${city}`);
        console.log(`duplicateCity: ${duplicateCity}`);
        throw new Error('Expected save to fail but it succeeded');
      } catch (err) {
        console.log('Actual error:', err.name, err.message);
        // Accept both ValidationError (mongoose) or MongoServerError (MongoDB)
        expect(
          err instanceof mongoose.Error.ValidationError || 
          err.name === 'MongoServerError'
        ).to.be.true;
        expect(err.message).to.include('duplicate key error');
        expect(err.code).to.equal(11000); // Duplicate key error code
      }
    });

    it('should populate state virtual', async () => {
      const city = await City.create({ 
        name: 'San Diego', 
        stateId: testState._id 
      });
      const populatedCity = await City.findById(city._id).populate('state');
      expect(populatedCity.state).to.exist;
      expect(populatedCity.state.name).to.equal('California');
    });

    it('should have stateId index', async () => {
      const indexes = await City.collection.indexes();
      const stateIdIndex = indexes.find(index => index.key.stateId === 1);
      expect(stateIdIndex).to.exist;
    });
  });

  describe('Cascade Deletion', () => {
    it('should delete associated locations when city is deleted', async () => {
      const city = await City.create({ 
        name: 'Sacramento', 
        stateId: testState._id 
      });
      
      const testUserId = testUser._id;
    
      await Location.create([
        { 
          name: 'Capitol Location', 
          cityId: city._id, 
          userId: testUserId,
          phone_number: '+15551234567',
          address: '123 Main St'
        },
        { 
          name: 'Downtown Location', 
          cityId: city._id, 
          userId: testUserId,
          phone_number: '+15551234167',
          address: '456 Oak Ave'
        }
      ]);

      await city.deleteOne();
      const remainingLocations = await Location.find({ cityId: city._id });
      expect(remainingLocations).to.have.lengthOf(0);
    });

    it('should handle deletion of cities with no locations', async () => {
      const city = await City.create({ 
        name: 'Fresno', 
        stateId: testState._id 
      });
      
      await city.deleteOne();
      const remainingCity = await City.find({ _id: city._id });
      //console.log(`remainingCity: ${remainingCity}`);
      expect(remainingCity).to.have.lengthOf(0);
    });

    it('should handle bulk deletion with cascade', async () => {
      const cities = await City.create([
        { name: 'San Francsco', stateId: testState._id },
        { name: 'San Diego', stateId: testState._id }
      ]);
      //console.log(`cities: ${cities}`);
    
      await Location.create([
        { 
          name: 'Capitol Location 2', 
          cityId: cities[0]._id, 
          userId: testUser._id,
          phone_number: '+15551234560',
          address: '123 Main St 1'
        }
      ]);
    
      await Location.create([
        { 
          name: 'Downtown Location 2', 
          cityId: cities[1]._id, 
          userId: testUser._id,
          phone_number: '+15551234160',
          address: '456 Oak Ave 1'
        }
      ]);

      await City.deleteMany({ _id: { $in: cities.map(c => c._id) } });
      
      const remainingLocations = await Location.find({
        cityId: { $in: cities.map(c => c._id) }
      });
      //console.log(`remainingLocations: ${remainingLocations}`);
      const remainingCities = await City.find({ _id: { $in: cities.map(c => c._id) } });
      //console.log(`remainingCities: ${remainingCities}`);
      expect(remainingCities).to.have.lengthOf(0);
      expect(remainingLocations).to.have.lengthOf(0);
    });
  });

  describe('JSON Transformation', () => {
    it('should return id instead of _id', async () => {
      const city = await City.create({ 
        name: 'JSON Test', 
        stateId: testState._id 
      });
      
      const jsonCity = city.toJSON();
      expect(jsonCity.id).to.equal(city._id.toString());
      expect(jsonCity._id).to.be.undefined;
    });

    it('should remove __v from output', async () => {
      const city = await City.create({ 
        name: 'Version Test', 
        stateId: testState._id 
      });
      
      const jsonCity = city.toJSON();
      expect(jsonCity.__v).to.be.undefined;
    });
  });

  describe('Update Validation', () => {
    it('should validate stateId on update', async () => {
      const city = await City.create({ 
        name: 'Update Test', 
        stateId: testState._id 
      });
    
      city.stateId = new mongoose.Types.ObjectId();
      try {
        await city.save();
        throw new Error('Expected validation to fail but it passed');
      } catch (error) {
        expect(error.message).to.match(/Invalid state reference/);
      }
    });

    it('should maintain unique constraint on updates', async () => {
      await City.create({ name: 'Oakland', stateId: testState._id });
      const city = await City.create({ name: 'Berkeley', stateId: testState._id });
    
      city.name = 'Oakland';
      try {
        await city.save();
        throw new Error('Expected unique constraint to fail but it passed');
      } catch (error) {
        expect(error).to.have.property('code', 11000); // MongoDB duplicate key error code
      }
    });
  });

  describe('Query Helpers', () => {
    it('should find cities by state', async () => {
      await City.create([
        { name: 'San Jose', stateId: testState._id },
        { name: 'Portland', stateId: (await State.create({ name: 'Oregon' }))._id }
      ]);

      const californiaCities = await City.find({ stateId: testState._id });
      expect(californiaCities).to.have.lengthOf(1);
      expect(californiaCities[0].name).to.equal('San Jose');
    });

    it('should sort cities by name', async () => {
      await City.create([
        { name: 'Z City', stateId: testState._id },
        { name: 'A City', stateId: testState._id }
      ]);

      const cities = await City.find().sort({ name: 1 });
      expect(cities[0].name).to.equal('A City');
      expect(cities[1].name).to.equal('Z City');
    });
  });
});
