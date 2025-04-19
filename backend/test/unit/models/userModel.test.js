const { expect } = require('chai');
const { faker } = require('@faker-js/faker');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../../../models/User');

const TEST_DB_URI = 'mongodb://localhost:27017/car-rental-test';
const SALT_ROUNDS = 12;

describe('User Model Integration Tests', () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  after(async () => {
    await User.deleteMany({});
    await mongoose.disconnect();
  });

  describe('Schema Validation', () => {
    it('should create and save a user successfully', async () => {
      const userData = {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: faker.internet.password()
      };

      const validUser = new User(userData);
      const savedUser = await validUser.save();

      // Check required fields
      expect(savedUser._id).to.exist;
      expect(savedUser.email).to.equal(userData.email.toLowerCase());
      expect(savedUser.password).to.not.equal(userData.password); // Should be hashed
    });

    it('should require name, email, and password fields', async () => {
      const user = new User({});
      
      let error;
      try {
        await user.validate();
      } catch (err) {
        error = err;
      }
      
      expect(error.errors.name).to.exist;
      expect(error.errors.email).to.exist;
      expect(error.errors.password).to.exist;
    });

    it('should validate email format', async () => {
      const user = new User({
        name: 'Invalid Email',
        email: 'not-an-email',
        password: 'password123'
      });

      let error;
      try {
        await user.validate();
      } catch (err) {
        error = err;
      }
      
      expect(error.errors.email).to.exist;
      expect(error.errors.email.message).to.include('valid email');
    });

    it('should enforce password minimum length', async () => {
      const user = new User({
        name: 'Short Password',
        email: faker.internet.email(),
        password: '123'
      });

      let error;
      try {
        await user.validate();
      } catch (err) {
        error = err;
      }
      
      expect(error.errors.password).to.exist;
      expect(error.errors.password.message).to.include('at least');
    });

    it('should validate isAdmin as boolean', async () => {
      const user = new User({
        name: 'Invalid Admin Flag',
        email: faker.internet.email(),
        password: 'password123',
        isAdmin: 'not-a-boolean' // Invalid boolean
      });

      let error;
      try {
        await user.validate();
      } catch (err) {
        error = err;
      }
  
      expect(error.errors.isAdmin).to.exist;
      expect(error.errors.isAdmin.message).to.include('Boolean');
    });
  });

  describe('Password Handling', () => {
    it('should hash password before saving', async () => {
      const plainPassword = 'secret123';
      const user = new User({
        name: 'Password Test',
        email: faker.internet.email(),
        password: plainPassword
      });

      const savedUser = await user.save();
      expect(savedUser.password).to.not.equal(plainPassword);
      expect(savedUser.password).to.match(/^\$2[aby]\$\d+\$/); // BCrypt pattern
    });

    it('should correctly compare valid password', async () => {
      const plainPassword = 'securePass!123';
      const user = new User({
        name: 'Password Compare',
        email: faker.internet.email(),
        password: plainPassword
      });

      const savedUser = await user.save();
      const isMatch = await savedUser.comparePassword(plainPassword);
      expect(isMatch).to.be.true;
    });

    it('should reject invalid password comparison', async () => {
      const user = new User({
        name: 'Invalid Password',
        email: faker.internet.email(),
        password: 'correctPassword'
      });

      const savedUser = await user.save();
      const isMatch = await savedUser.comparePassword('wrongPassword');
      expect(isMatch).to.be.false;
    });
  });

  describe('Email Handling', () => {
    it('should save email in lowercase', async () => {
      const mixedCaseEmail = 'TestUser@Example.COM';
      const user = new User({
        name: 'Email Case Test',
        email: mixedCaseEmail,
        password: 'password123'
      });

      const savedUser = await user.save();
      expect(savedUser.email).to.equal(mixedCaseEmail.toLowerCase());
    });

    it('should prevent duplicate emails (case-insensitive)', async () => {
      const email = 'user@example.com';
      await User.create({
        name: 'Original User',
        email: email,
        password: 'password123'
      });

      const duplicateUser = new User({
        name: 'Duplicate User',
        email: 'USER@EXAMPLE.COM', // Different case
        password: 'password456'
      });

      let error;
      try {
        await duplicateUser.save();
      } catch (err) {
        error = err;
      }
      
      expect(error).to.exist;
      expect(error.code).to.equal(11000);
    });
  });

  describe('Query Safety', () => {
    it('should not return password in find results', async () => {
      const user = await User.create({
        name: 'Security Test',
        email: faker.internet.email(),
        password: 'password123'
      });

      const foundUser = await User.findOne({ email: user.email });
      expect(foundUser.password).to.be.undefined;
    });

    it('should allow password retrieval with explicit select', async () => {
      const user = await User.create({
        name: 'Password Select',
        email: faker.internet.email(),
        password: 'password123'
      });

      const userWithPassword = await User.findById(user._id).select('+password');
      expect(userWithPassword.password).to.exist;
    });
  });

  describe('Indexes', () => {
    it('should have unique index on email', async () => {
      const indexes = await User.collection.indexes();
      const emailIndex = indexes.find(index => index.key.email === 1);
      
      expect(emailIndex).to.exist;
      expect(emailIndex.unique).to.be.true;
    });

    it('should have createdAt index for faster queries', async () => {
      const indexes = await User.collection.indexes();
      const createdAtIndex = indexes.find(index => index.key.createdAt === 1);
      expect(createdAtIndex).to.exist;
    });
  });

  describe('Virtuals', () => {
    it('should have id virtual', async () => {
      const user = new User({
        name: 'Virtual Test',
        email: faker.internet.email(),
        password: 'password123'
      });

      const savedUser = await user.save();
      expect(savedUser.id).to.exist;
      expect(savedUser.id).to.equal(savedUser._id.toString());
    });

    it('should not return password in JSON output', () => {
      const user = new User({
        name: 'JSON Test User',
        email: faker.internet.email(),
        password: 'test123'
      });

      const userJson = user.toJSON();
      expect(userJson.password).to.be.undefined;
      expect(userJson.id).to.exist; // Check virtual 'id' field
    });

    it('should exclude _id and __v from JSON output', () => {
      const user = new User({
        name: 'JSON Test',
        email: faker.internet.email(),
        password: 'password123'
      });

      const jsonUser = user.toJSON();
      expect(jsonUser._id).to.be.undefined;
      expect(jsonUser.__v).to.be.undefined;
    });
  });

  describe('Timestamps', () => {
    it('should automatically add createdAt and updatedAt', async () => {
      const user = new User({
        name: 'Timestamp Test',
        email: faker.internet.email(),
        password: 'password123'
      });

      const savedUser = await user.save();
      expect(savedUser.createdAt).to.exist;
      expect(savedUser.updatedAt).to.exist;
    });

    it('should update updatedAt on modification', async () => {
      const user = await User.create({
        name: 'Update Test',
        email: faker.internet.email(),
        password: 'password123'
      });

      const originalUpdatedAt = user.updatedAt;
      
      // Wait 1 second to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 1000));
      user.name = 'Updated Name';
      const updatedUser = await user.save();

      expect(updatedUser.updatedAt).to.not.equal(originalUpdatedAt);
    });
  });
});
