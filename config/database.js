const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stuwork';
    const conn = await mongoose.connect(mongoURI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('\n❌ Database connection error:', error.message);
    console.error('\n⚠️  MongoDB is not running or connection string is incorrect.');
    console.error('\n📝 Solutions:');
    console.error('   1. Start MongoDB locally: mongod');
    console.error('   2. Use MongoDB Atlas (cloud): Update MONGODB_URI in .env file');
    console.error('   3. Check your MONGODB_URI in backend/.env file');
    console.error('\n💡 See FIX_MONGODB.md for detailed instructions\n');
    process.exit(1);
  }
};

module.exports = connectDB;
