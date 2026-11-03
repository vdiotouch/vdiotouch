// Sets a new password for one user, for when they've forgotten theirs. Needs server access, on purpose:
// there is no HTTP route for this, so a leaked api key can't be used to take over accounts.
//
// Run it from server/api:
//   npm run user:set-password -- user@example.com
// Or inside the api container:
//   docker compose exec video-touch-api node scripts/set-user-password.js user@example.com
//
// The new password is asked for at the prompt (twice, not shown), so it never lands in shell history.
// Piping it in also works: `printf '%s\n' "$NEW_PASSWORD" | npm run user:set-password -- user@example.com`.
//
// It also sets `password_changed_at`, so every token issued before now stops working:
// the user is logged out on every device and logs in again with the new password.

const path = require('path');
const readline = require('readline');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Keep these in sync with src/api/auth/constants.ts.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;
const BCRYPT_COST = 12;
const USER_COLLECTION_NAME = 'users';

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** The api reads server/.env; outside the container MONGO_DB_URL usually comes from there too. */
function loadEnvFile() {
  if (process.env.MONGO_DB_URL) {
    return;
  }
  try {
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
  } catch {
    // dotenv isn't installed; MONGO_DB_URL must then be set in the environment.
  }
}

/** Reads one line from stdin. On a terminal the typed characters aren't echoed. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (process.stdin.isTTY) {
      // Print the question once, then swallow the echo of every key typed after it.
      rl._writeToOutput = (text) => {
        if (text.startsWith(question)) {
          rl.output.write(question);
        }
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (process.stdin.isTTY) {
        process.stdout.write('\n');
      }
      resolve(answer);
    });
  });
}

function validatePassword(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `The password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return `The password must be at most ${PASSWORD_MAX_BYTES} bytes.`;
  }
  return null;
}

async function readNewPassword() {
  const password = await askHidden('New password: ');
  const error = validatePassword(password);
  if (error) {
    fail(error);
  }
  if (process.stdin.isTTY) {
    const confirmation = await askHidden('Confirm new password: ');
    if (confirmation !== password) {
      fail("The passwords don't match. Nothing was changed.");
    }
  }
  return password;
}

async function main() {
  const rawEmail = process.argv[2];
  if (!rawEmail) {
    fail('Usage: npm run user:set-password -- <email>');
  }
  // Same normalization as the api (src/api/auth/lib/normalize-email.ts).
  const email = rawEmail.trim().toLowerCase();

  loadEnvFile();
  const mongoUrl = process.env.MONGO_DB_URL;
  if (!mongoUrl) {
    fail('MONGO_DB_URL is not set. Set it, or run this from server/api with server/.env in place.');
  }

  await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    const users = mongoose.connection.collection(USER_COLLECTION_NAME);
    const user = await users.findOne({ email }, { projection: { _id: 1 } });
    if (!user) {
      fail(`No user with the email ${email}. Nothing was changed.`);
    }

    const password = await readNewPassword();
    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);
    // Written directly, not through the api's model, so the pre-save hook doesn't hash it a second time.
    await users.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword, password_changed_at: new Date(), updatedAt: new Date() } },
    );
    console.log(`Password updated for ${email}. They are logged out everywhere and can log in with the new password.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => fail(error.message));
