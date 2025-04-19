// test/unit/utils/cleanup.test.js
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const { cleanOrphanedImages } = require('../../../utils/cleanup');
const User = require('../../../models/User');
const State = require('../../../models/State');
const City = require('../../../models/City');
const Location = require('../../../models/Location');
const Car = require('../../../models/Car');

// Test configuration
const TEST_DB_URI = 'mongodb://localhost:27017/car-rental-test';
const TEST_UPLOAD_DIR = path.join(__dirname, '../../../test-uploads/cars');

describe('Image Cleanup Utility', () => {
  let testUser, testState, testCity, testLocation;
  const userData = {
    name: 'Test User',
    email: faker.internet.email(),
    password: faker.internet.password()
  };
  before(async () => {
    // Setup test database and override upload directory
    await mongoose.connect(TEST_DB_URI);
    process.env.UPLOAD_DIR = TEST_UPLOAD_DIR; // Override for testing
    
    // Ensure clean state
    await mongoose.connection.db.dropDatabase();
    if (fs.existsSync(TEST_UPLOAD_DIR)) {
      fs.rmdirSync(TEST_UPLOAD_DIR, { recursive: true });
    }
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
    // Create fresh upload directory
    fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });
    await Car.deleteMany({});
  });

  after(async () => {
    await User.deleteMany({});
    await State.deleteMany({});
    // Cleanup test environment
    await mongoose.disconnect();
    if (fs.existsSync(TEST_UPLOAD_DIR)) {
      fs.rmdirSync(TEST_UPLOAD_DIR, { recursive: true });
    }
  });

  it('should delete orphaned image files', async () => {
    // Create test files
    const usedFile = 'used-image.jpg';
    const orphanFile = 'orphan-image.jpg';
    
    fs.writeFileSync(path.join(TEST_UPLOAD_DIR, usedFile), 'dummy');
    fs.writeFileSync(path.join(TEST_UPLOAD_DIR, orphanFile), 'dummy');

    // Create database record for used file
    const testCar = await Car.create({
      imageUrl: `/images/cars/${usedFile}`,
      // Other required car fields
      brand: 'Test',
      model: 'Cleanup',
      year: 2023,
      priceByDay: 50,
      registrationNumber: 'TEST123',
      locationId: testLocation._id
    });

    console.log(`testCar: ${testCar}`);
    const testCarById = await Car.find({ _id: testCar._id });
    console.log(`testCarById: ${testCarById}`);
    await cleanOrphanedImages();

    // Verify results
    const remainingFiles = fs.readdirSync(TEST_UPLOAD_DIR);
    console.log(`remainingFiles: ${remainingFiles}`);
    expect(remainingFiles).to.include(usedFile);
    expect(remainingFiles).to.not.include(orphanFile);
  });
});
