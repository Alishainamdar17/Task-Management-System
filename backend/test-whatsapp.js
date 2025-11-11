#!/usr/bin/env node

/**
 * Quick Test Script for WhatsApp Integration
 * 
 * Usage:
 *   node test-whatsapp.js
 *   
 * यह script check करेगा:
 * 1. Database connection
 * 2. Users और उनके phone numbers
 * 3. WhatsApp configuration
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Task = require('./models/Task');

async function runTests() {
  console.log('\n🔍 WhatsApp Integration Test\n');
  console.log('=' .repeat(50));

  try {
    // Test 1: Database Connection
    console.log('\n1️⃣  Testing Database Connection...');
    if (!process.env.MONGODB_URI) {
      console.log('❌ MONGODB_URI not set in .env');
      return;
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected');

    // Test 2: Check Users with Phone Numbers
    console.log('\n2️⃣  Checking Users...');
    const totalUsers = await User.countDocuments();
    const usersWithPhone = await User.countDocuments({ phone: { $exists: true, $ne: null } });
    
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Users with phone: ${usersWithPhone}`);
    
    if (usersWithPhone === 0) {
      console.log('   ⚠️  No users have phone numbers!');
      console.log('   Add phone numbers using:');
      console.log('   db.users.updateOne({ email: "user@example.com" }, { $set: { phone: "919876543210" } })');
    } else {
      console.log('   ✅ Some users have phone numbers');
      const sample = await User.findOne({ phone: { $exists: true, $ne: null } }).select('name phone email');
      if (sample) {
        console.log(`   Sample: ${sample.name} (${sample.phone})`);
      }
    }

    // Test 3: Check WhatsApp Configuration
    console.log('\n3️⃣  Checking WhatsApp Configuration...');
    const WA_MODE = (process.env.WA_MODE || '').trim().toLowerCase() || 'auto';
    console.log(`   WA_MODE: ${WA_MODE}`);

    if (WA_MODE === 'baileys' || WA_MODE === 'auto') {
      console.log('   📱 Using Baileys (Free WhatsApp)');
      const hasAuth = require('fs').existsSync(__dirname + '/auth');
      if (hasAuth) {
        console.log('   ✅ Auth directory exists');
      } else {
        console.log('   ⚠️  Auth directory not found. Scan QR at /qr after starting server');
      }
    }

    if (WA_MODE === 'cloud' || (WA_MODE === 'auto' && process.env.WHATSAPP_TOKEN)) {
      console.log('   ☁️  Using Cloud API');
      if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
        console.log('   ✅ Cloud API credentials configured');
      } else {
        console.log('   ❌ Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
      }
    }

    if (WA_MODE === 'auto' && !process.env.WHATSAPP_TOKEN) {
      console.log('   ⚠️  Will use Baileys by default');
    }

    // Test 4: Check if Tasks with Assignees exist
    console.log('\n4️⃣  Checking Tasks...');
    const totalTasks = await Task.countDocuments();
    const tasksWithAssignees = await Task.countDocuments({ assignees: { $exists: true, $ne: [] } });
    
    console.log(`   Total tasks: ${totalTasks}`);
    console.log(`   Tasks with assignees: ${tasksWithAssignees}`);

    // Test 5: Summary
    console.log('\n5️⃣  Summary & Recommendations:\n');
    
    let readyToGo = true;

    if (usersWithPhone === 0) {
      console.log('❌ ACTION REQUIRED: Add phone numbers to users');
      readyToGo = false;
    } else {
      console.log('✅ Users have phone numbers');
    }

    if (WA_MODE === 'baileys' || (WA_MODE === 'auto' && !process.env.WHATSAPP_TOKEN)) {
      if (require('fs').existsSync(__dirname + '/auth')) {
        console.log('✅ Baileys is configured');
      } else {
        console.log('❌ ACTION REQUIRED: Scan QR code at /qr after starting server');
        readyToGo = false;
      }
    } else if (process.env.WHATSAPP_TOKEN) {
      console.log('✅ Cloud API is configured');
    }

    console.log('\n' + '='.repeat(50));
    if (readyToGo) {
      console.log('\n✅ Everything looks good! Messages should work.');
      console.log('\nTest by:');
      console.log('1. Create a new task');
      console.log('2. Assign it to a user with a phone number');
      console.log('3. Check terminal logs for: [whatsapp.baileys] ✅ Message sent successfully');
    } else {
      console.log('\n⚠️  Please fix the issues above before WhatsApp messages will work.');
    }
    console.log('');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Run tests
runTests().catch(console.error);
