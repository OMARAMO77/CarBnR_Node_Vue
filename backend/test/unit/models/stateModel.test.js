// test/unit/models/stateModel.test.js
const { expect } = require('chai');
const mongoose = require('mongoose');
const State = require('../../../models/State');
const City = require('../../../models/City');

const TEST_DB_URI = 'mongodb://localhost:27017/car-rental-test';

describe('State Model Integration Tests', function() {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);
    await mongoose.connection.db.dropDatabase();
  });

  beforeEach(async () => {
    await State.deleteMany({});
  });

  after(async () => {
    await State.deleteMany({});
    await mongoose.disconnect();
    //console.log('[4/4] Disconnected from MongoDB');
  });


  describe('State Model Validation', () => {
    it('should create a state with valid name', async () => {
      const state = new State({ name: 'California' });
      const savedState = await state.save();
      
      expect(savedState).to.have.property('_id');
      expect(savedState.name).to.equal('California');
      expect(savedState).to.have.property('createdAt');
      expect(savedState).to.have.property('updatedAt');
    });

    it('should trim whitespace from state name', async () => {
      const state = new State({ name: '  New York  ' });
      const savedState = await state.save();
      
      expect(savedState.name).to.equal('New York');
    });

    it('should capitalize state name properly', async () => {
      const state = new State({ name: 'north dakota' });
      const savedState = await state.save();
      
      expect(savedState.name).to.equal('North Dakota');
    });

    it('should normalize state name capitalization', async () => {
      const testCases = [
        { input: 'nEw yOrKer', expected: 'New Yorker' },
        { input: 'cALiFoRniAo', expected: 'Californiao' },
        { input: 'flORIdAo', expected: 'Floridao' }
      ];

      for (const testCase of testCases) {
        const state = await State.create({ name: testCase.input });
        expect(state.name).to.equal(testCase.expected);
      }
    });

    it('should reject duplicate state names', async () => {
      const state = await State.create({ name: 'Texas' });
      await State.ensureIndexes(); // Ensure indexes are built
      const duplicateState = new State({ name: 'Texas' });
    
      try {
        await duplicateState.save();
        console.log(`state: ${state}`);
        console.log(`duplicateState: ${duplicateState}`);
        throw new Error('Should have failed');
      } catch (err) {
        // Accept both ValidationError (mongoose) or MongoServerError (MongoDB)
        expect(
          err instanceof mongoose.Error.ValidationError || 
          err.name === 'MongoServerError'
        ).to.be.true;
        expect(err.message).to.include('duplicate key error');
      }
    });

    it('should normalize different case duplicates', async () => {
      await State.create({ name: 'California' });
      const duplicateState = new State({ name: 'california' });
    
      try {
        await duplicateState.save();
        throw new Error('Should have failed');
      } catch (err) {
        // Accept both error types
        expect(
          err instanceof mongoose.Error.ValidationError || 
          err.name === 'MongoServerError'
        ).to.be.true;
        expect(err.message).to.include('duplicate key error');
      }
    });
    it('should enforce unique state names', async () => {
      const stateName = 'California';
      await State.create({ name: stateName });

      const duplicateState = new State({ name: stateName });
      let error;

      try {
        await duplicateState.save();
      } catch (err) {
        error = err;
      }

      expect(error).to.exist;
      expect(error.code).to.equal(11000); // MongoDB duplicate key error code
      expect(error.message).to.include('duplicate key error');
    });

    it('should require name field', async () => {
      const state = new State({});
      let error;

      try {
        await state.save();
      } catch (err) {
        error = err;
      }

      expect(error).to.be.an.instanceOf(mongoose.Error.ValidationError);
      expect(error.errors.name).to.exist;
      expect(error.errors.name.message).to.equal('State name is required');
    });

    it('should reject empty state name', async () => {
      const state = new State({ name: '' });
      
      try {
        await state.save();
        throw new Error('Should have failed');
      } catch (err) {
        expect(err).to.be.instanceOf(mongoose.Error.ValidationError);
        expect(err.errors.name).to.exist;
      }
    });

    it('should reject state name shorter than 2 characters', async () => {
      const state = new State({ name: 'A' });
      
      try {
        await state.save();
        throw new Error('Should have failed');
      } catch (err) {
        expect(err).to.be.instanceOf(mongoose.Error.ValidationError);
        expect(err.errors.name).to.exist;
      }
    });

    it('should reject state name longer than 50 characters', async () => {
      const longName = 'A'.repeat(51);
      const state = new State({ name: longName });
      
      try {
        await state.save();
        throw new Error('Should have failed');
      } catch (err) {
        expect(err).to.be.instanceOf(mongoose.Error.ValidationError);
        expect(err.errors.name).to.exist;
      }
    });
  });


  describe('State Model Middleware', () => {
    it('should normalize case on update', async () => {
      const state = await State.create({ name: 'florida' });
      const updatedState = await State.findByIdAndUpdate(
        state._id,
        { name: 'FLORIDA' },
        { new: true }
      );
      
      expect(updatedState.name).to.equal('Florida');
    });

    it('should update autocomplete virtual on name change', async () => {
      const state = await State.create({ name: 'Virginia' });
      await State.findByIdAndUpdate(state._id, { name: 'West Virginia' });
      const updatedState = await State.findById(state._id);
      
      expect(updatedState.name_autocomplete).to.equal('westvirginia');
    });

    it('should cascade delete cities when state is deleted', async () => {
      const state = await State.create({ name: 'Arizona' });
      await City.create([
        { name: 'Phoenix', stateId: state._id },
        { name: 'Tucson', stateId: state._id }
      ]);
      //console.log(`state: ${state}`);
      //const cities = await City.find({ stateId: state._id });
      //console.log(`cities: ${cities}`);
      await State.findByIdAndDelete(state._id);

      const remainingCities = await City.find({ stateId: state._id });
      //console.log(`remainingCities: ${remainingCities}`);
      const remainingState = await State.find({ _id: state._id });
      //console.log(`remainingState: ${remainingState}`);
      expect(remainingCities).to.have.lengthOf(0);
      expect(remainingState).to.have.lengthOf(0);
    });

    it('should handle bulk deletion with cascade', async () => {
      const states = await State.create([
        { name: 'Washington' },
        { name: 'Oregon' }
      ]);
      //console.log(`states: ${states}`);
      await City.create([
        { name: 'Seattle', stateId: states[0]._id },
        { name: 'Portland', stateId: states[1]._id }
      ]);
      //const cities = await City.find({
      //  stateId: { $in: states.map(s => s._id) }
      //});
      //console.log(`cities: ${cities}`);
      await State.deleteMany({ _id: { $in: states.map(s => s._id) } });
      
      const remainingCities = await City.find({
        stateId: { $in: states.map(s => s._id) }
      });
      //console.log(`remainingCities: ${remainingCities}`);
      const remainingStates = await State.find({ _id: { $in: states.map(s => s._id) } });
      //console.log(`remainingStates: ${remainingStates}`);
      expect(remainingCities).to.have.lengthOf(0);
      expect(remainingStates).to.have.lengthOf(0);
    });
  });

  describe('State Model Virtuals and Indexes', () => {
    before(async () => {
      // Wait for index creation to complete
      await State.collection.createIndex({ name: 'text' });
      await State.collection.createIndex({ createdAt: 1 });
      // Alternatively: await Car.init(); // If indexes are defined in schema
    });
    it('should have text index for name field', async () => {
      const indexes = await State.collection.indexes();
      const textIndex = indexes.find(index => index.name === 'name_text');
      //console.log(`textIndex: ${textIndex}`);
      expect(textIndex).to.exist;
      expect(textIndex.weights.name).to.equal(1);
    });

    it('should have createdAt index', async () => {
      const indexes = await State.collection.indexes();
      const createdAtIndex = indexes.find(index => index.key.createdAt === 1);
      expect(createdAtIndex).to.exist;
    });

    it('should have name_autocomplete virtual', async () => {
      const state = await State.create({ name: 'New Mexico' });
      expect(state.name_autocomplete).to.equal('newmexico');
    });

    it('should support case-insensitive search', async () => {
      await State.create({ name: 'Colorado' });
      
      const states = await State.find({ name: /colorado/i });
      expect(states).to.have.lengthOf(1);
    });

    it('should support text search', async () => {
      const states = await State.create([
        { name: 'Alabama' },
        { name: 'Alaska' },
        { name: 'California' } // Negative control
      ]);

      const searchTerm = 'ala';

      //const createdStates = await State.find({ _id: { $in: states.map(s => s._id) } });
      //console.log(`createdStates: ${createdStates}`);
      const searchedStates = await State.find({
        name: { $regex: searchTerm, $options: 'i' }
      });

      //console.log('Search results:', searchedStates.map(s => s.name));
      expect(searchedStates).to.have.lengthOf(2);
      expect(searchedStates.some(s => s.name === 'Alabama')).to.be.true;
      expect(searchedStates.some(s => s.name === 'Alaska')).to.be.true;
    });
  });

  describe('Query Helpers', () => {
    it('should find states by case-insensitive search', async () => {
      await State.create({ name: 'Washington' });
      
      const results = await State.find({ $text: { $search: 'washington' } })
        .select('name')
        .lean();

      expect(results).to.have.lengthOf(1);
      expect(results[0].name).to.equal('Washington');
    });

    it('should sort by creation date using index', async () => {
      const states = await State.create([
        { name: 'Older State', createdAt: new Date('2023-01-01') },
        { name: 'Newer State', createdAt: new Date() }
      ]);

      const sorted = await State.find().sort({ createdAt: 1 });
      expect(sorted[0].name).to.equal('Older State');
      expect(sorted[sorted.length - 1].name).to.equal('Newer State');
    });
  });

  describe('State Model Serialization', () => {
    it('should serialize to JSON without _id and __v', async () => {
      const state = await State.create({ name: 'Nevada' });
      const jsonState = state.toJSON();
      
      expect(jsonState).to.not.have.property('_id');
      expect(jsonState).to.not.have.property('__v');
      expect(jsonState.id).to.exist;
      expect(jsonState.name).to.equal('Nevada');
      expect(jsonState.createdAt).to.exist;
      expect(jsonState.updatedAt).to.exist;
    });
  });
});
