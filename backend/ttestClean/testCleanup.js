#!/usr/bin/env node
const { cleanOrphanedImages } = require('../utils/cleanup');
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to DB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Create test scenario
    const testCleanup = async () => {
      // 1. Create a dummy file in uploads
      const fs = require('fs');
      const path = require('path');
      const uploadDir = path.join(__dirname, '../uploads/cars');

      console.log(`uploadDir: ${uploadDir}`);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const orphanFile = path.join(uploadDir, 'test_orphan.jpg');
      fs.writeFileSync(orphanFile, 'dummy data');
      console.log(`orphanFile: ${orphanFile}`);

      // 2. Run cleanup
      console.log('Running cleanup...');
      await cleanOrphanedImages();

      // 3. Verify
      if (!fs.existsSync(orphanFile)) {
        console.log('? Test passed: Orphaned file was deleted');
      } else {
        console.log('? Test failed: Orphaned file still exists');
      }

      process.exit(0);
    };

    testCleanup();
  })
  .catch(err => {
    console.error('DB connection error:', err);
    process.exit(1);
  });
