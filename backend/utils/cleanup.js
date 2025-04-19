// utils/cleanup.js
const fs = require('fs');
const path = require('path');
const Car = require('../models/Car');

const cleanOrphanedImages = async () => {
  try {
    // Get all used image URLs from the database
    const cars = await Car.find({});
    const usedImages = cars.map(car => 
      car.imageUrl.split('/images/cars/')[1]
    ).filter(Boolean);
    console.log(`usedImages: ${usedImages}`);
    // Scan uploads directory
    const uploadDir = path.join(__dirname, '../uploads/cars');
    if (!fs.existsSync(uploadDir)) return;

    const files = fs.readdirSync(uploadDir);
    console.log(`files: ${files}`);

    // Delete orphaned files
    files.forEach(file => {
      if (!usedImages.includes(file)) {
        const filePath = path.join(uploadDir, file);
        console.log(`filePath: ${filePath}`);
        fs.unlinkSync(filePath);
        console.log(`Deleted orphaned file: ${file}`);
      }
    });

    console.log('Cleanup completed');
  } catch (err) {
    console.error('Cleanup error:', err);
  }
};

module.exports = { cleanOrphanedImages };
