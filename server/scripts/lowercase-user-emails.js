// One-off: trims and lowercases every user email, because the api now looks emails up lowercased.
// Run it once after deploying, against the api's database:
//   mongosh "$MONGO_DB_URL" server/scripts/lowercase-user-emails.js
// Add `--eval 'var dryRun = true'` before the file name to only print what would change.
//
// Two accounts whose emails differ only in case (A@x.com and a@x.com) can't both be lowercased,
// because email is unique. The script skips them and prints them, so they can be merged by hand.

const isDryRun = typeof dryRun !== 'undefined' && dryRun === true;
const users = db.users.find({}, { email: 1 }).toArray();

const byNormalized = new Map();
for (const user of users) {
  const normalized = user.email.trim().toLowerCase();
  byNormalized.set(normalized, [...(byNormalized.get(normalized) || []), user]);
}

let updated = 0;
let conflicts = 0;
for (const [normalized, group] of byNormalized) {
  if (group.length > 1) {
    conflicts += 1;
    print(`SKIPPED, same email in different case: ${group.map((user) => `${user.email} (${user._id})`).join(', ')}`);
    continue;
  }
  const user = group[0];
  if (user.email === normalized) {
    continue;
  }
  print(`${user.email} -> ${normalized}`);
  if (!isDryRun) {
    db.users.updateOne({ _id: user._id }, { $set: { email: normalized } });
  }
  updated += 1;
}

print(`${isDryRun ? 'Would update' : 'Updated'} ${updated} of ${users.length} users. ${conflicts} conflict(s) skipped.`);
