const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/taxiweb';
  let retries = 5;
  while (retries) {
    try {
      await mongoose.connect(uri);
      console.log('MongoDB connected successfully');
      break;
    } catch (err) {
      retries -= 1;
      console.error(`MongoDB connection failed. Retries left: ${retries}. Error: ${err.message}`);
      if (retries === 0) {
        console.error('Could not connect to MongoDB. App will continue without DB.');
        break;
      }
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

module.exports = connectDB;
