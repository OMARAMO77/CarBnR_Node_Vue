// test/unit/models/reservationModel.test.js
const { expect } = require('chai');
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const User = require('../../../models/User');
const State = require('../../../models/State');
const City = require('../../../models/City');
const Location = require('../../../models/Location');
const Car = require('../../../models/Car');
const Reservation = require('../../../models/Reservation');

const TEST_DB_URI = 'mongodb://localhost:27017/car-rental-test';

describe('Reservation Model Integration Tests', () => {
  let testUser, testState, testCity, testLocation, testCar;
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
    testCar = await Car.create({
      locationId: testLocation._id,
      brand: 'Toyota',
      model: 'Camry',
      year: 2025,
      priceByDay: 100,
      registrationNumber: 'ABC123',
      imageUrl: 'http://example.com/car.jpg'
    });
  });

  afterEach(async () => {
    await Reservation.deleteMany({});
  });

  after(async () => {
    await User.deleteMany({});
    await State.deleteMany({});
    await mongoose.disconnect();
  });

  describe('Schema Validation', () => {
    it('should create a valid reservation', async () => {
      const reservationData = {
        carId: testCar._id,
        userId: testUser._id,
        startDate: new Date(Date.now() + 86400000), // Tomorrow
        endDate: new Date(Date.now() + 2 * 86400000) // Day after tomorrow
      };

      const reservation = new Reservation(reservationData);
      const savedReservation = await reservation.save();
      
      expect(savedReservation).to.have.property('_id');
      expect(savedReservation.status).to.equal('pending');
      expect(savedReservation.totalPrice).to.equal(100);
    });

    it('should require all mandatory fields', async () => {
      const reservation = new Reservation({});
      let error;

      try {
        await reservation.save();
      } catch (err) {
        error = err;
      }

      expect(error).to.be.an.instanceOf(mongoose.Error.ValidationError);
      expect(error.errors.carId).to.exist;
      expect(error.errors.userId).to.exist;
      expect(error.errors.startDate).to.exist;
      expect(error.errors.endDate).to.exist;
    });

    it('should validate start date is in future', async () => {
      const reservationData = {
        carId: testCar._id,
        userId: testUser._id,
        startDate: new Date(2020, 1, 1),
        endDate: new Date(Date.now() + 86400000)
      };

      const reservation = new Reservation(reservationData);
      let error;

      try {
        await reservation.save();
      } catch (err) {
        error = err;
      }

      expect(error.errors.startDate.message).to.include('future');
    });

    it('should validate end date after start date', async () => {
      const reservationData = {
        carId: testCar._id,
        userId: testUser._id,
        startDate: new Date(Date.now() + 2 * 86400000),
        endDate: new Date(Date.now() + 86400000)
      };

      const reservation = new Reservation(reservationData);
      let error;

      try {
        await reservation.save();
      } catch (err) {
        error = err;
      }

      expect(error.errors.endDate.message).to.include('after');
    });
  });

  describe('Middleware Functions', () => {
    it('should calculate total price correctly', async () => {
      const start = new Date(Date.now() + 86400000);
      const end = new Date(start.getTime() + 3 * 86400000);
      
      const reservation = await Reservation.create({
        carId: testCar._id,
        userId: testUser._id,
        startDate: start,
        endDate: end
      });

      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      expect(reservation.totalPrice).to.equal(days * testCar.priceByDay);
    });

    it('should prevent overlapping reservations', async () => {
      // Create initial reservation
      await Reservation.create({
        carId: testCar._id,
        userId: testUser._id,
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 2 * 86400000)
      });

      // Create overlapping reservation
      const overlappingReservation = new Reservation({
        carId: testCar._id,
        userId: testUser._id,
        startDate: new Date(Date.now() + 1.5 * 86400000),
        endDate: new Date(Date.now() + 2.5 * 86400000)
      });

      let error;
      try {
        await overlappingReservation.save();
      } catch (err) {
        error = err;
      }

      expect(error).to.exist;
      expect(error.message).to.include('already reserved');
    });
  });

  describe('Reference Validation', () => {
    it('should validate car reference exists', async () => {
      const reservationData = {
        carId: new mongoose.Types.ObjectId(),
        userId: testUser._id,
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 2 * 86400000)
      };

      const reservation = new Reservation(reservationData);
      let error;

      try {
        await reservation.save();
      } catch (err) {
        error = err;
      }

      expect(error.errors.carId.message).to.include('Invalid car reference');
    });

    it('should validate user reference exists', async () => {
      const reservationData = {
        carId: testCar._id,
        userId: new mongoose.Types.ObjectId(),
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 2 * 86400000)
      };

      const reservation = new Reservation(reservationData);
      let error;

      try {
        await reservation.save();
      } catch (err) {
        error = err;
      }

      expect(error.errors.userId.message).to.include('Invalid user reference');
    });
  });

  describe('JSON Transformation', () => {
    it('should transform output correctly', async () => {
      const reservation = await Reservation.create({
        carId: testCar._id,
        userId: testUser._id,
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 2 * 86400000)
      });

      const jsonReservation = reservation.toJSON();
      
      expect(jsonReservation.id).to.equal(reservation._id.toString());
      expect(jsonReservation._id).to.be.undefined;
      expect(jsonReservation.__v).to.be.undefined;
    });
  });

  describe('Status Handling', () => {
    it('should default to pending status', async () => {
      const reservation = await Reservation.create({
        carId: testCar._id,
        userId: testUser._id,
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 2 * 86400000)
      });

      expect(reservation.status).to.equal('pending');
    });

    it('should validate status enum values', async () => {
      const reservation = new Reservation({
        carId: testCar._id,
        userId: testUser._id,
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 2 * 86400000),
        status: 'invalid-status'
      });

      let error;
      try {
        await reservation.save();
      } catch (err) {
        error = err;
      }

      expect(error.errors.status.message).to.include('enum');
    });
  });
});
