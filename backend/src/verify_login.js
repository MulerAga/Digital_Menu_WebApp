require('dotenv').config();
const authController = require('./controllers/authController');

async function testLogin(email, password, slug) {
  const req = {
    body: { email, password, slug }
  };
  let statusVal = 200;
  let jsonVal = null;
  const res = {
    status(code) {
      statusVal = code;
      return this;
    },
    json(data) {
      jsonVal = data;
      return this;
    }
  };

  try {
    await authController.loginWithApprovalCheck(req, res);
    console.log(`[Test] email: ${email}, slug: ${slug} => Status: ${statusVal}`);
    console.log('Result:', jsonVal);
    console.log('------------------------------------');
  } catch (err) {
    console.error('Test error:', err);
  }
}

(async () => {
  console.log('Starting authentication slug validation verification...\n');

  // Test 1: Admin logging in with correct slug (Expected: 200 Success with token & restaurant_slug)
  await testLogin('ammmmmm123@gmail.com', 'admin123', 'alemitu-restaurant-1');

  // Test 2: Admin logging in with wrong slug (Expected: 403 "You do not belong to this restaurant.")
  await testLogin('ammmmmm123@gmail.com', 'admin123', 'alemitu-restaurant');

  // Test 3: Staff logging in with correct slug (Expected: 403 "Your account is waiting for approval...")
  await testLogin('ayeleabebe@gmail.com', 'admin123', 'alemitu-restaurant-1');

  // Test 4: Staff logging in with wrong slug (Expected: 403 "You do not belong to this restaurant.")
  await testLogin('ayeleabebe@gmail.com', 'admin123', 'alemitu-restaurant');

  process.exit(0);
})();
