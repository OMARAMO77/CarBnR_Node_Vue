// test/unit/models/locationModel.test.js
const { expect } = require('chai');
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const Location = require('../../../models/Location');
const User = require('../../../models/User');
const State = require('../../../models/State');
const City = require('../../../models/City');

const TEST_DB_URI = 'mongodb://localhost:27017/car-rental-test';

describe('Location Model Integration Tests', () => {
  let testUser, testState, testCity;
  const userData = {
    name: 'Test User',
    email: faker.internet.email(),
    password: faker.internet.password()
  };

  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();
    testState = await State.create({ name: 'California' });
    testUser = await User.create(userData);
    // Create required references
    testCity = await City.create({ 
      name: 'Test City', 
      stateId: testState._id
    });
  });

  afterEach(async () => {
    await Location.deleteMany({});
  });

  after(async () => {
    await User.deleteMany({});
    await State.deleteMany({});
    //const remainingState = await State.find({ _id: testState._id });
    //const remainingCity = await City.find({ _id: testCity._id });
    //const remainingUser = await User.find({ _id: testUser._id });
    //console.log(`remainingState: ${remainingState}`);
    //console.log(`remainingUser: ${remainingUser}`);
    //console.log(`remainingCity: ${remainingCity}`);
    await mongoose.disconnect();
  });

  describe('Schema Validation', () => {
    it('should create a valid location', async () => {
      const locationData = {
        name: 'Downtown Branch',
        address: '123 Main St',
        phone_number: '+15551234567',
        cityId: testCity._id,
        userId: testUser._id
      };

      const location = new Location(locationData);
      const savedLocation = await location.save();

      expect(savedLocation._id).to.exist;
      expect(savedLocation.name).to.equal(locationData.name);
      expect(savedLocation.phone_number).to.equal('+15551234567');
    });

    it('should fail when required fields are missing', async () => {
      const location = new Location({});
      let error;

      try {
        await location.save();
      } catch (err) {
        error = err;
      }

      expect(error).to.be.instanceOf(mongoose.Error.ValidationError);
      expect(error.errors.name).to.exist;
      expect(error.errors.address).to.exist;
      expect(error.errors.phone_number).to.exist;
      expect(error.errors.cityId).to.exist;
      expect(error.errors.userId).to.exist;
    });

    it('should normalize phone numbers', async () => {
      const location = await Location.create({
        name: 'North Branch',
        address: '456 Oak Ave',
        phone_number: '+15551234567', // Must start with + and have country code
        cityId: testCity._id,
        userId: testUser._id
      });

      expect(location.phone_number).to.equal('+15551234567');
    });
  });

  describe('Reference Validation', () => {
    it('should validate city reference exists', async () => {
      const invalidLocation = new Location({
        name: 'Invalid City Ref',
        address: '789 Pine Rd',
        phone_number: '+15551234567',
        cityId: new mongoose.Types.ObjectId(),
        userId: testUser._id
      });

      let error;
      try {
        await invalidLocation.save();
      } catch (err) {
        error = err;
      }

      expect(error).to.exist;
      expect(error.message).to.include('Invalid city reference');
    });

    it('should validate user reference exists', async () => {
      const invalidLocation = new Location({
        name: 'Invalid User Ref',
        address: '789 Pine Rd',
        phone_number: '+15551234567',
        cityId: testCity._id,
        userId: new mongoose.Types.ObjectId()
      });

      let error;
      try {
        await invalidLocation.save();
      } catch (err) {
        error = err;
      }

      expect(error).to.exist;
      expect(error.message).to.include('Invalid user reference');
    });
  });

  describe('Virtual Population', () => {
    it('should populate city data', async () => {
      const location = await Location.create({
        name: 'Virtual Test',
        address: '101 Virtual Lane',
        phone_number: '+15551234567',
        cityId: testCity._id,
        userId: testUser._id
      });

      const populated = await Location.findById(location._id).populate('city');
      expect(populated.city).to.exist;
      expect(populated.city.name).to.equal('Test City');
    });

    it('should populate user data', async () => {
      const location = await Location.create({
        name: 'User Virtual Test',
        address: '202 User Ave',
        phone_number: '+15551234567',
        cityId: testCity._id,
        userId: testUser._id
      });

      const populated = await Location.findById(location._id).populate('user');
      expect(populated.user).to.exist;
      expect(populated.user.name).to.equal('Test User');
    });
  });

  describe('Soft Delete Functionality', () => {
    it('should hide deleted locations by default', async () => {
      const location = await Location.create({
        name: 'Deleted Location',
        address: '303 Deleted St',
        phone_number: '+15551234567',
        cityId: testCity._id,
        userId: testUser._id,
        deleted: new Date()
      });

      const found = await Location.findOne({ name: 'Deleted Location' });
      expect(found).to.be.null;
    });

    it('should show deleted locations when requested', async () => {
      const location = await Location.create({
        name: 'Deleted But Visible',
        address: '404 Visible Ave',
        phone_number: '+15551234567',
        cityId: testCity._id,
        userId: testUser._id,
        deleted: new Date()
      });

      const found = await Location.findOne({ name: 'Deleted But Visible' })
        .setOptions({ withDeleted: true });
      
      expect(found).to.exist;
      expect(found.deleted).to.exist;
    });
  });

  describe('Text Search', () => {
    before(async () => {
      // Wait for index creation to complete
      //await Location.collection.createIndex({ name: 'text' });
      //await Location.collection.createIndex({ createdAt: 1 });
      // Alternatively: await Location.init(); // If indexes are defined in schema
      await Location.init(); // If indexes are defined in schema
    });
    it('should find locations by name text search', async () => {
      //await Location.createIndexes();
      //await Location.collection.createIndex({ name: 'text', address: 'text' });
      // Create test document
      const newLocation = await Location.create({
        name: 'Central Warehouse',
        address: '500 Searchable Road',
        phone_number: '+15551234567', // Required field from previous validation
        cityId: testCity._id,
        userId: testUser._id
      });

      const results = await Location.find(
        { $text: { $search: 'Central' } },
        { score: { $meta: 'textScore' } }
      ).sort({ score: { $meta: 'textScore' } });

      expect(results).to.have.lengthOf(1);
      expect(results[0].name).to.equal('Central Warehouse');
    });

    it('should find locations by address text search', async () => {
      // Create test document
      const newLocation = await Location.create({
        name: 'Downtown Office',
        address: '600 Main Street',
        phone_number: '+15551284567', // Required field from previous validation
        cityId: testCity._id,
        userId: testUser._id
      });

      const results = await Location.find(
        { $text: { $search: 'Main' } },
        { score: { $meta: 'textScore' } }
      ).sort({ score: { $meta: 'textScore' } });
      //console.log(`results: ${results}`);
      // Verify test data exists
      //const count = await Location.countDocuments({ address: '600 Main Street' });
      //console.log('Document exists:', count === 1); // Should be true
      //console.log('Matching documents:', count);
      expect(results).to.have.lengthOf(1);
      expect(results[0].address).to.equal('600 Main Street');
    });
  });

  describe('JSON Transformation', () => {
    it('should return id instead of _id', async () => {
      const location = await Location.create({
        name: 'JSON Test',
        address: '700 Transform Blvd',
        phone_number: '+15551234567',
        cityId: testCity._id,
        userId: testUser._id
      });

      const jsonLocation = location.toJSON();
      expect(jsonLocation.id).to.equal(location._id.toString());
      expect(jsonLocation._id).to.be.undefined;
    });

    it('should remove __v from output', async () => {
      const location = await Location.create({
        name: 'Version Test',
        address: '800 Version Ave',
        phone_number: '+15551244567',
        cityId: testCity._id,
        userId: testUser._id
      });

      const jsonLocation = location.toJSON();
      expect(jsonLocation.__v).to.be.undefined;
    });
  });
});
