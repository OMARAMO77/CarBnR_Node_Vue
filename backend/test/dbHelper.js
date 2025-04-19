// test/dbHelper.js
const mongoose = require('mongoose');

module.exports = {
  connect: async (dbName) => {
    const uri = `mongodb://localhost:27017/${dbName}`;
    await mongoose.connect(uri);
    return mongoose.connection;
  },
  disconnect: async () => {
    await mongoose.disconnect();
  },
  cleanup: async (models) => {
    await Promise.all(
      models.map(model => 
        model.deleteMany({}).maxTimeMS(30000).catch(() => {})
      )
    );
  }
};
